import path from "path"
import fs from "fs"
import {
	replaceSlash,
	replaceIndexStyle,
	replaceInject,
	stripBaseFromPathname,
	getMergedInject,
	rewriteHtmlRelativeAssetRefsToRoot,
} from "./utils.js"

const PREFIX = "\0virtual-page:"

/**
 * 虚拟 HTML 的相对 `root` 路径仅由 **rollup `input` 的键** 决定，使构建产物与键一致（如 `index` + `app/v3/index.html` → `index.html`）。
 * **值**为磁盘上真实 `*.html` 路径（可为绝对路径），供 `resolveId` 与 `load` 读取。
 * 默认会把标签里 `./` / `../` 的 `script[src]`、`link[href]` 改成相对 `root` 的 URL（并带 `base`），这样 `dist/index.html` 与源码在 `app/v3/` 时仍可用 `./main.js` 书写，而无需手写死路径（见 `rewriteHtmlRelativeToRoot`）。
 * @param {string} k rollup input 键
 * @param {string} _fileVal 保留参数（兼容旧调用，不参与路径计算）
 * @param {string|undefined} _root 保留参数
 * @param {string} indexKey 主入口文件名，如 `index.html`
 */
export function computeVirtualPath(k, _fileVal, _root, indexKey) {
	if (k.endsWith(".html")) return replaceSlash(k)
	if (k === "index") return indexKey
	return `${k}/${indexKey}`
}

/** 入口 `input` 值在磁盘上相对 `root` 的 .html 路径，无法解析时返回 `null` */
function htmlRelToRoot(fileVal, root) {
	if (!root || !fileVal) return null
	const abs = path.isAbsolute(fileVal) ? path.normalize(fileVal) : path.join(root, fileVal)
	try {
		const rel = replaceSlash(path.relative(root, abs))
		if (rel && !rel.startsWith("..") && !path.isAbsolute(rel) && /\.html$/i.test(rel)) {
			return rel
		}
	} catch {
		// ignore
	}
	return null
}

function aliasRealHtmlPathToKey(map, k, fileVal, root) {
	const rel = htmlRelToRoot(fileVal, root)
	// 多键同文件时只保留先出现的键，供 dev 用真实路径只命中一个 input（如 inject）
	if (rel && !map[rel]) map[rel] = k
}

function readHtmlFile(root, relPathFromRoot) {
	const p = path.isAbsolute(relPathFromRoot) ? relPathFromRoot : path.join(root, relPathFromRoot)
	return fs.promises.readFile(p, "utf-8")
}

function logDebug(config, ...args) {
	if (config.debug) console.log("[vite-plugin-mpa]", ...args)
}

/**
 * @param {Record<string, string>} inputMap
 * @param {string} root
 * @param {string} k
 */
function absPathForInputKey(inputMap, root, k) {
	const v = inputMap[k]
	if (v == null || !root) return null
	return path.isAbsolute(v) ? path.normalize(v) : path.join(root, v)
}

export function MpaPlugin(config = {}) {
	let indexCount = 0
	let resolvedConfig
	const indexKey =
		typeof config.indexHtml === "string" && config.indexHtml.trim()
			? config.indexHtml.endsWith(".html")
				? config.indexHtml
				: `${config.indexHtml}.html`
			: "index.html"
	let inputMap = {}
	/** 虚拟「键名路径」与真实 .html 相对 root 均映射到 rollup `input` 键 */
	let virtualToKey = Object.create(null)
	/** @param {string} html @param {string} inputKey */
	function applyRelativeRewrite(html, inputKey) {
		if (config.rewriteHtmlRelativeToRoot === false) return html
		const abs = absPathForInputKey(inputMap, resolvedConfig?.root, inputKey)
		if (!abs || !resolvedConfig?.root) return html
		return rewriteHtmlRelativeAssetRefsToRoot(html, abs, resolvedConfig.root, resolvedConfig.base || "/")
	}
	return {
		name: "Mpa",
		configResolved(resolved) {
			resolvedConfig = resolved
		},
		options(option) {
			const input = option.input
			if (!indexCount) {
				inputMap = structuredClone(input)
				indexCount++
				virtualToKey = Object.create(null)
				const root = resolvedConfig?.root
				for (const k in inputMap) {
					const vPath = computeVirtualPath(k, inputMap[k], root, indexKey)
					option.input[k] = PREFIX + vPath
					const vKey = replaceSlash(vPath)
					virtualToKey[vKey] = k
					aliasRealHtmlPathToKey(virtualToKey, k, inputMap[k], root)
				}
			}
		},
		/**
		 * Vite 会先把各页 HTML 写到「源文件相对 outDir」路径；与虚拟键名路径不一致时再挪到键名位置（无 outHtml 配置，插件内建）。
		 * 多个 `input` 键可指向**同一** `*.html`：先按源路径分组，从同一份 Vite 产物**复制**到各键对应路径，再**删一次**源文件，避免只挪第一份导致第二份因源已删而缺页。
		 */
		writeBundle(rollupOutOpts) {
			const outDir = rollupOutOpts.dir
			if (!outDir || !resolvedConfig?.root) return
			const root = resolvedConfig.root
			/** @type {Map<string, string[]>} 源侧相对 outDir 的 .html 路径 -> 要落位的虚拟路径列表 */
			const byFrom = new Map()
			for (const k of Object.keys(inputMap)) {
				const fromRel = htmlRelToRoot(inputMap[k], root)
				if (!fromRel) continue
				const vKey = replaceSlash(computeVirtualPath(k, inputMap[k], root, indexKey))
				if (fromRel === vKey) continue
				if (!byFrom.has(fromRel)) byFrom.set(fromRel, [])
				byFrom.get(fromRel).push(vKey)
			}
			for (const [fromRel, vKeys] of byFrom) {
				const from = path.join(outDir, fromRel)
				if (!fs.existsSync(from)) {
					logDebug(config, "writeBundle:skip (no source html)", from)
					continue
				}
				const unique = [...new Set(vKeys)]
				try {
					for (const vKey of unique) {
						const to = path.join(outDir, vKey)
						if (from === to) continue
						fs.mkdirSync(path.dirname(to), { recursive: true })
						fs.copyFileSync(from, to)
						logDebug(config, "writeBundle:relayout", fromRel, "→", vKey)
					}
					fs.unlinkSync(from)
					pruneEmptyParentDirsUp(path.dirname(from), outDir)
				} catch (e) {
					logDebug(config, "writeBundle:error", e)
				}
			}
		},
		resolveId(id) {
			if (id.startsWith(PREFIX)) {
				const vKey = replaceSlash(id.slice(PREFIX.length))
				const k = virtualToKey[vKey]
				if (k == null) return null
				const fileVal = inputMap[k]
				if (fileVal == null) return null
				return path.isAbsolute(fileVal) ? path.normalize(fileVal) : path.join(resolvedConfig.root, fileVal)
			}
			return null
		},
		async load(id) {
			const rel = replaceSlash(path.relative(resolvedConfig.root, id))
			if (!/\.html$/i.test(rel)) return null
			if (!Object.keys(inputMap).length) return null

			try {
				if (Object.prototype.hasOwnProperty.call(inputMap, rel) && /\.html$/i.test(rel)) {
					const inputKey = rel
					let code = await readHtmlFile(resolvedConfig.root, inputMap[inputKey])
					code = await runTransformHtml(config, code, { key: inputKey, phase: "load" })
					code = applyRelativeRewrite(code, inputKey)
					const injectObj = getMergedInject(config, inputKey)
					code = config.inject != null || config.injectPages ? replaceInject(code, injectObj) : code
					logDebug(config, "load:direct", rel, "→", inputKey)
					return code
				}
				if (Object.prototype.hasOwnProperty.call(virtualToKey, rel) && virtualToKey[rel]) {
					const inputKey = virtualToKey[rel]
					let code = await readHtmlFile(resolvedConfig.root, inputMap[inputKey])
					code = await runTransformHtml(config, code, { key: inputKey, phase: "load" })
					code = applyRelativeRewrite(code, inputKey)
					const useStyle = config.styleInline !== false && !inputKey.endsWith(".html") && inputKey !== "index"
					if (useStyle) {
						code = replaceIndexStyle(code)
					}
					code = config.inject != null || config.injectPages ? replaceInject(code, getMergedInject(config, inputKey)) : code
					logDebug(config, "load:virtual", rel, "→", inputKey)
					return code
				}
				const subId = rel.replace(/[\\/]?index\.html$/i, "") || "index"
				if (Object.prototype.hasOwnProperty.call(inputMap, subId)) {
					const inputKey = subId
					let code = await readHtmlFile(resolvedConfig.root, inputMap[inputKey])
					code = await runTransformHtml(config, code, { key: inputKey, phase: "load" })
					code = applyRelativeRewrite(code, inputKey)
					if (config.styleInline !== false) {
						code = replaceIndexStyle(code)
					}
					code = config.inject != null || config.injectPages ? replaceInject(code, getMergedInject(config, inputKey)) : code
					logDebug(config, "load:sub", rel, "→", inputKey)
					return code
				}
			} catch (e) {
				const err = new Error(
					`[vite-plugin-mpa] 读取 HTML 失败: ${rel} — ${e && e.message ? e.message : e}`,
					{ cause: e },
				)
				throw err
			}
			return null
		},
		// `order: 'pre'`，在 public 等静态资源之前走虚拟 URL（与 `computeVirtualPath` 一致），开发时才能稳定用 /index.html、/login/index.html 等
		configureServer: {
			order: "pre",
			handler(server) {
				const { middlewares } = server
				middlewares.use(async (req, res, next) => {
					const base = resolvedConfig.base || "/"
					let pathName = stripBaseFromPathname(req._parsedUrl.pathname, base)
					if (/^(?!.*@).*$/gi.test(req._parsedUrl.pathname) && /^$|\.html$/.test(path.extname(pathName))) {
						const key = pathName.endsWith(".html")
							? pathName
							: pathName == ""
								? `${indexKey}`
								: `${pathName}/${indexKey}`
						if (key == indexKey) {
							if (!Object.prototype.hasOwnProperty.call(inputMap, "index")) {
								return next()
							}
							try {
								let code = await readHtmlFile(resolvedConfig.root, inputMap["index"])
								const inputKey = "index"
								code = await runTransformHtml(config, code, { key: inputKey, phase: "serve" })
								code = applyRelativeRewrite(code, inputKey)
								if (config.inject != null || config.injectPages) {
									code = replaceInject(code, getMergedInject(config, inputKey))
								}
								logDebug(config, "serve:/*", "→", inputKey, `(base=${base})`)
								res.setHeader("Content-Type", "text/html; charset=utf-8")
								return res.end(code)
							} catch (e) {
								logDebug(config, "serve:error", e)
								return next(e)
							}
						}
						if (Object.prototype.hasOwnProperty.call(virtualToKey, key) && virtualToKey[key]) {
							const inputKey = virtualToKey[key]
							try {
								let code = await readHtmlFile(resolvedConfig.root, inputMap[inputKey])
								code = await runTransformHtml(config, code, { key: inputKey, phase: "serve" })
								code = applyRelativeRewrite(code, inputKey)
								if (config.inject != null || config.injectPages) {
									code = replaceInject(code, getMergedInject(config, inputKey))
								}
								logDebug(config, "serve:virtual", key, "→", inputKey)
								res.setHeader("Content-Type", "text/html; charset=utf-8")
								return res.end(code)
							} catch (e) {
								logDebug(config, "serve:error", e)
								return next(e)
							}
						}
						if (Object.prototype.hasOwnProperty.call(inputMap, pathName)) {
							try {
								const inputKey = pathName
								let code = await readHtmlFile(resolvedConfig.root, inputMap[pathName])
								code = await runTransformHtml(config, code, { key: inputKey, phase: "serve" })
								code = applyRelativeRewrite(code, inputKey)
								if (config.inject != null || config.injectPages) {
									code = replaceInject(code, getMergedInject(config, inputKey))
								}
								logDebug(config, "serve:path", pathName, "→", inputKey)
								res.setHeader("Content-Type", "text/html; charset=utf-8")
								return res.end(code)
							} catch (e) {
								logDebug(config, "serve:error", e)
								return next(e)
							}
						}
					}
					return next()
				})
			},
		},
	}
}

function pruneEmptyParentDirsUp(dir, stopAt) {
	let d = dir
	while (d !== stopAt && d.startsWith(stopAt) && fs.existsSync(d)) {
		const names = fs.readdirSync(d)
		if (names.length) break
		try {
			fs.rmdirSync(d)
		} catch {
			break
		}
		d = path.dirname(d)
	}
}

async function runTransformHtml(config, code, ctx) {
	if (typeof config.transformHtml === "function") {
		return await config.transformHtml(code, ctx)
	}
	return code
}
