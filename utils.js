import path from "path"

const bodyInject = /<\/body>/

export function replaceSlash(str) {
	return str?.replaceAll(/[\\/]+/g, "/")
}

/**
 * 从 `base` 开始解析（如 Vite 的 `config.base`）时，把请求 `pathname` 变成相对站点根的路径段（不含前导 /）。
 * @param {string} pathname 如 /app/about 或 /about
 * @param {string} base 如 /app/ 或 /
 */
export function stripBaseFromPathname(pathname, base) {
	const b = (base == null || base === "" ? "/" : base).replaceAll("\\", "/")
	if (b === "/" || b === "./" || b === ".") {
		return pathname.replace(/^\//, "") || ""
	}
	let bNorm = b.endsWith("/") ? b.slice(0, -1) : b
	if (!bNorm.startsWith("/")) bNorm = "/" + bNorm
	let p = pathname.replaceAll("\\", "/")
	if (p.endsWith("/") && p.length > 1) p = p.slice(0, -1)
	if (p === bNorm) return ""
	if (p.startsWith(bNorm + "/")) return p.slice(bNorm.length + 1) || ""
	return p.replace(/^\//, "") || ""
}

/**
 * 根据相对 `root` 的 HTML 相对路径，解析到 `input` 的**键**（如 index、about）
 * @param {string} rel 如 index.html、about/index.html、或键名为 foo.html 时
 * @param {Record<string, string>} inputMap
 * @param {string} _indexKey 保留与插件内部 index 文件名一致
 */
export function resolveInputKey(rel, inputMap) {
	const id = replaceSlash(rel) || ""
	if (Object.prototype.hasOwnProperty.call(inputMap, id)) {
		return id
	}
	const subId = id.replace(/[\\/]?index\.html$/i, "") || "index"
	if (Object.prototype.hasOwnProperty.call(inputMap, subId)) {
		return subId
	}
	return null
}

/** @param {Record<string, unknown>} config @param {string} inputKey */
export function getMergedInject(config, inputKey) {
	let base = {}
	if (typeof config.inject === "function") {
		base = { ...(config.inject({ key: inputKey }) || {}) }
	} else if (config.inject && typeof config.inject === "object") {
		base = { ...config.inject }
	}
	if (config.injectPages && config.injectPages[inputKey]) {
		Object.assign(base, config.injectPages[inputKey])
	}
	return base
}

export function cssmin(text, preserveComments) {
	var str = preserveComments ? text : text.replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g, "")

	return str
		.replace(/\s{1,}/g, " ")
		.replace(/\{\s{1,}/g, "{")
		.replace(/\}\s{1,}/g, "}")
		.replace(/\;\s{1,}/g, ";")
		.replace(/\/\*\s{1,}/g, "/*")
		.replace(/\*\/\s{1,}/g, "*/")
}

/**
 * 子页 <style> 转脚本注入；CSS 用 JSON.stringify 写入 textContent，避免反引号与 ${} 破坏脚本。
 */
export function replaceIndexStyle(code) {
	let styles = []
	code = code.replace(/<style>([\s\S]*?)<\/style>/gi, (match, style) => {
		styles.push(style)
		return ``
	})
	for (let i = 0; i < styles.length; i++) {
		const payload = JSON.stringify(cssmin(styles[i]))
		code = code.replace(
			bodyInject,
			`<script>var s=document.createElement("style");s.textContent=${payload};document.head.appendChild(s);</script>\n</body>`,
		)
	}
	return code
}

export function replaceInject(html, inject) {
	inject = inject || {}
	return html.replace(/<%=\s*(\w+)\s*%>/gi, (match, p1) => inject[p1] || "")
}

/**
 * 将 `<script src="./...">`、`<link href="./...">` 中相对当前 HTML 的路径，改为相对 Vite `root` 的「站点」URL（带 `config.base` 前缀），
 * 多页 `input` 的键与源码目录脱钩、且构建后 HTML 会挪到 `dist` 的键名路径时，Vite 仍能稳定解析到真实 `main.js` 等，而不必在源码里写死根路径。
 * @param {string} base Vite 的 `config.base`，如 `/` 或 `/app/`
 */
export function rewriteHtmlRelativeAssetRefsToRoot(html, absHtmlFile, root, base = "/") {
	if (html == null || absHtmlFile == null || root == null) return html
	const rootNorm = path.normalize(root)
	const absDir = path.dirname(path.normalize(absHtmlFile))

	function relToUrl(/** @type {string} */ relUrl) {
		if (relUrl == null || relUrl === "" || (!relUrl.startsWith("./") && !relUrl.startsWith("../"))) return null
		let resolved
		try {
			resolved = path.normalize(path.resolve(absDir, relUrl))
		} catch {
			return null
		}
		let fromRoot
		try {
			fromRoot = path.relative(rootNorm, resolved)
		} catch {
			return null
		}
		if (!fromRoot || fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) return null
		return rootRelToPublicUrl(fromRoot, base)
	}

	function sub(/** @type {string} */ _m, p1, quote, relUrl) {
		const u = relToUrl(relUrl)
		return u == null ? _m : `${p1}${quote}${u}${quote}`
	}

	let out = html
	out = out.replace(/(<script\b[^>]*\bsrc=)(["'])(\.\.?\/[^"']*)\2/gi, sub)
	out = out.replace(/(<link\b[^>]*\bhref=)(["'])(\.\.?\/[^"']*)\2/gi, sub)
	return out
}

/**
 * 相对 project root 的 posix 段 → 带 base 的浏览器路径（/app/v3/main.js 或 /sub/app/v3/main.js）
 * @param {string} relFromRoot 如 `app/v3/main.js`（无开头 /）
 * @param {string} [base]
 */
function rootRelToPublicUrl(relFromRoot, base) {
	const r = replaceSlash(relFromRoot).replace(/^\/+/, "")
	const b = base == null || base === "" ? "/" : String(base).replace(/\\/g, "/")
	if (b === "/" || b === "./") return `/${r}`
	if (/^https?:\/\//i.test(b)) {
		try {
			return new URL(r, b.endsWith("/") ? b : `${b}/`).href
		} catch {
			return `/${r}`
		}
	}
	const prefix = b.endsWith("/") ? b : `${b}/`
	return `${prefix}${r}`.replace(/([^/])\/\//g, "$1/").replace(/^\/{2,}/, "/")
}
