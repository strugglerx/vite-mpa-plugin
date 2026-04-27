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
