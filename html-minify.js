import { minify } from "html-minifier-terser"

export function htmlMinifyPlugin(options = {}) {
	return {
		name: "vite:html-minify",
		enforce: "post",
		apply: "build",
		transformIndexHtml: (html) => {
			return minify(html, {
				removeComments: true,
				collapseWhitespace: true,
				collapseBooleanAttributes: true,
				removeEmptyAttributes: true,
				minifyCSS: true,
				minifyJS: true,
				minifyURLs: true,
				...options,
			})
		},
	}
}
