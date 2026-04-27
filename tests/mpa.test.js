import { describe, it, expect } from "vitest"
import { stripBaseFromPathname, resolveInputKey, getMergedInject, replaceIndexStyle, replaceInject } from "../utils.js"

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

describe("replaceInject", () => {
	it("replaces tags", () => {
		expect(replaceInject("<p><%=x%></p>", { x: "h" })).toBe("<p>h</p>")
	})
})
