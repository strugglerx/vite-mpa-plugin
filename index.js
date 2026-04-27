export { MpaPlugin } from "./plugin.js"
import { MpaPlugin } from "./plugin.js"
import { htmlMinifyPlugin } from "./html-minify.js"

export function createMpaPlugin(config = {}) {
	const { htmlMinify, ...mpa } = config
	return !htmlMinify
		? [MpaPlugin(mpa)]
		: [MpaPlugin(mpa), htmlMinifyPlugin(htmlMinify === true ? {} : htmlMinify)]
}
