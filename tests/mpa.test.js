import { describe, it, expect } from "vitest"
import {
	stripBaseFromPathname,
	resolveInputKey,
	getMergedInject,
	replaceIndexStyle,
	replaceInject,
	rewriteHtmlRelativeAssetRefsToRoot,
} from "../utils.js"
import { computeVirtualPath } from "../plugin.js"

describe("stripBaseFromPathname", () => {
	it("root base", () => {
		expect(stripBaseFromPathname("/about", "/")).toBe("about")
		expect(stripBaseFromPathname("/", "/")).toBe("")
	})
	it("subpath base", () => {
		expect(stripBaseFromPathname("/app/about", "/app/")).toBe("about")
		expect(stripBaseFromPathname("/app", "/app/")).toBe("")
		expect(stripBaseFromPathname("/app/", "/app/")).toBe("")
	})
})

describe("resolveInputKey", () => {
	const map = { index: "index.html", about: "src/pages/about/index.html" }
	it("resolves index and about virtual paths", () => {
		expect(resolveInputKey("index.html", map)).toBe("index")
		expect(resolveInputKey("about/index.html", map)).toBe("about")
	})
})

describe("getMergedInject", () => {
	it("merges inject and injectPages", () => {
		const config = {
			inject: { a: "1", b: "2" },
			injectPages: { about: { b: "3" } },
		}
		expect(getMergedInject(config, "index")).toEqual({ a: "1", b: "2" })
		expect(getMergedInject(config, "about")).toEqual({ a: "1", b: "3" })
	})
	it("function inject", () => {
		const config = {
			inject: ({ key }) => ({ t: key }),
		}
		expect(getMergedInject(config, "about")).toEqual({ t: "about" })
	})
})

describe("replaceIndexStyle", () => {
	it("uses textContent + JSON and survives backticks in CSS", () => {
		const html = "<html><body>xx<style>div::before{content:`x`}</style></body></html>"
		const out = replaceIndexStyle(html)
		expect(out).toContain("textContent=")
		expect(out).toContain("createElement")
		expect(out).not.toContain("innerHTML")
		const m = out.match(/textContent=(.+);document\.head/)
		expect(m, "textContent 应有 JSON 字面量").toBeTruthy()
		expect(() => JSON.parse(m[1])).not.toThrow()
	})
})

describe("rewriteHtmlRelativeAssetRefsToRoot", () => {
	const root = "/proj/app-root"
	const absHtml = "/proj/app-root/app/v3/index.html"
	it("rewrites ./main.js to root URL path", () => {
		const html = '<script type="module" src="./main.js"></script>'
		const out = rewriteHtmlRelativeAssetRefsToRoot(html, absHtml, root, "/")
		expect(out).toContain('src="/app/v3/main.js"')
	})
	it("applies config.base", () => {
		const html = '<script type="module" src="./main.js"></script>'
		const out = rewriteHtmlRelativeAssetRefsToRoot(html, absHtml, root, "/sub/")
		expect(out).toContain('src="/sub/app/v3/main.js"')
	})
})

describe("replaceInject", () => {
	it("replaces tags", () => {
		expect(replaceInject("<p><%=x%></p>", { x: "h" })).toBe("<p>h</p>")
	})
})

describe("computeVirtualPath", () => {
	const root = "/proj"
	const indexKey = "index.html"
	it("与磁盘路径无关，只按 input 键决定虚拟路径，便于 dist 与键一致", () => {
		expect(computeVirtualPath("index", "app/page1/index.html", root, indexKey)).toBe("index.html")
		expect(computeVirtualPath("main", "app/page1/index.html", root, indexKey)).toBe("main/index.html")
		expect(computeVirtualPath("login", "app/page2/index.html", root, indexKey)).toBe("login/index.html")
	})
	it("无 root 时同样只按键", () => {
		expect(computeVirtualPath("about", "src/a.html", undefined, indexKey)).toBe("about/index.html")
	})
	it("键本身以 .html 结尾时原样为虚拟路径", () => {
		expect(computeVirtualPath("x/entry.html", "elsewhere/entry.html", root, indexKey)).toBe("x/entry.html")
	})
})
