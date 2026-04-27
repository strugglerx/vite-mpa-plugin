import { createRouter, createWebHashHistory } from "vue-router"
import ViewA from "./views/ViewA.vue"
import ViewB from "./views/ViewB.vue"

export default createRouter({
	history: createWebHashHistory(),
	routes: [
		{ path: "/", name: "a", component: ViewA },
		{ path: "/b", name: "b", component: ViewB },
	],
})
