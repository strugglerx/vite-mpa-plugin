import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { MpaPlugin } from "@struggler/vite-plugin-mpa"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const r = (...parts) => path.resolve(__dirname, ...parts)

/**
 * `input` 的**键**决定 dist 里 HTML 路径；**值**为各页真实 `index.html`。
 * 键 `main` 避免与 `public/index.html`（根导航）争 `/index.html`。
 * 多个键可指向同一 HTML 文件（如 `index` 与 `xxoo` 同指 `app/page1`），产物会各落一份到对应虚拟路径。
 */
export default defineConfig({
	root: __dirname,
	plugins: [vue(), MpaPlugin()],
	build: {
		rollupOptions: {
			input: {
				index: r("app/page1/index.html"),
				main: r("app/page1/index.html"),
				login: r("app/page2/index.html"),
			},
			output: {
				chunkFileNames: `static/js/[name]-[hash].js`,
				entryFileNames: `static/js/[name]-[hash].js`,
				assetFileNames: `static/[ext]/[name]-[hash].[ext]`,
				/* manualChunks: {
					vue: ["vue"]
				}, */
			},
		},
	},
})
