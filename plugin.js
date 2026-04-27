import path from "path"
import fs from "fs"
import {
	replaceSlash,
	replaceIndexStyle,
	replaceInject,
	stripBaseFromPathname,
	getMergedInject,
} from "./utils.js"

const PREFIX = "\0virtual-page:"

function readHtmlFile(root, relPathFromRoot) {
	const p = path.isAbsolute(relPathFromRoot) ? relPathFromRoot : path.join(root, relPathFromRoot)
	return fs.promises.readFile(p, "utf-8")
}

function logDebug(config, ...args) {
	if (config.debug) console.log("[vite-plugin-mpa]", ...args)
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
				for (const k in inputMap) {
					option.input[k] =
						PREFIX + (k.endsWith(".html") ? k : k == "index" ? indexKey : `${k}/${indexKey}`)
				}
			}
		},
		resolveId(id) {
			if (id.startsWith(PREFIX)) {
				return path.join(resolvedConfig.root, id.slice(PREFIX.length))
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
					const injectObj = getMergedInject(config, inputKey)
					code = config.inject != null || config.injectPages ? replaceInject(code, injectObj) : code
					logDebug(config, "load:direct", rel, "→", inputKey)
					return code
				}
				const subId = rel.replace(/[\\/]?index\.html$/i, "") || "index"
				if (Object.prototype.hasOwnProperty.call(inputMap, subId)) {
					const inputKey = subId
					let code = await readHtmlFile(resolvedConfig.root, inputMap[inputKey])
					code = await runTransformHtml(config, code, { key: inputKey, phase: "load" })
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
		configureServer(server) {
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
					if (Object.prototype.hasOwnProperty.call(inputMap, pathName)) {
						try {
							const inputKey = pathName
							let code = await readHtmlFile(resolvedConfig.root, inputMap[pathName])
							code = await runTransformHtml(config, code, { key: inputKey, phase: "serve" })
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
	}
}

async function runTransformHtml(config, code, ctx) {
	if (typeof config.transformHtml === "function") {
		return await config.transformHtml(code, ctx)
	}
	return code
}
