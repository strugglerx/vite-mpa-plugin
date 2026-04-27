import { createRouter, createWebHashHistory } from "vue-router"
import Home from "./views/Home.vue"
import Detail from "./views/Detail.vue"

export default createRouter({
	history: createWebHashHistory(),
	routes: [
		{ path: "/", name: "home", component: Home },
		{ path: "/detail", name: "detail", component: Detail },
	],
})
