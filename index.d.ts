import type { Plugin } from "vite"

export interface MpaHtmlContext {
	/** `rollupOptions.input` 的键，如 `index`、`about` */
	key: string
	/** `load` 为 Rollup 构建链；`serve` 为开发服务器中间件 */
	phase: "load" | "serve"
}

export interface MpaPluginConfig {
	/**
	 * 主入口 HTML 文件名，默认 `index.html`。
	 * 可写 `main` 或 `main.html`，后者与开发/虚拟路径中的主入口名一致。
	 */
	indexHtml?: string
	/**
	 * 全局占位符 `<%=\s*(\w+)\s*%>` 替换；或与 `injectPages` 合并。
	 * 传入函数时：`(ctx) => 键值对象`，再与 `injectPages[key]` 合并（页级覆盖全局）。
	 */
	inject?: Record<string, string> | ((ctx: { key: string }) => Record<string, string>)
	/** 按 `input` 键覆盖/补充 `inject` */
	injectPages?: Record<string, Record<string, string>>
	/**
	 * 在「目录型」入口（如 `about/index.html`）走 `load` 时，是否将 `<style>` 抽成脚本注入。
	 * @default true
	 */
	styleInline?: boolean
	/**
	 * 在读取 HTML 后、`replaceInject` 前执行（`serve` 阶段不做 `styleInline`）。
	 */
	transformHtml?: (html: string, ctx: MpaHtmlContext) => string | Promise<string>
	/** 为 true 时往控制台打解析路径（`[vite-plugin-mpa]` 前缀） */
	debug?: boolean
}

export type CreateMpaPluginConfig = MpaPluginConfig & {
	/**
	 * 为 `true` 时使用内置压缩默认项；为对象时与 [html-minifier-terser](https://github.com/terser/html-minifier-terser) 选项浅合并（仅 `build`）。
	 */
	htmlMinify?: boolean | Record<string, unknown>
}

export function MpaPlugin(config?: MpaPluginConfig): Plugin
export function createMpaPlugin(config?: CreateMpaPluginConfig): Plugin[]
