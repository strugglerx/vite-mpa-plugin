<template>
	<div class="page page1">
		<header>
			<h1>Page 1</h1>
			<p class="sub">独立入口 · 自己的 router + main</p>
		</header>
		<nav>
			<router-link to="/">子路由 A</router-link>
			<router-link to="/b">子路由 B</router-link>
		</nav>
		<main>
			<router-view />
		</main>
		<footer>源文件：<code>app/page1/*</code></footer>
	</div>
</template>

<style scoped>
.page {
		max-width: 42rem;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: system-ui, sans-serif;
	}
	.page1 {
		background: #f0f7ff;
		min-height: 100vh;
	}
	nav {
		display: flex;
		gap: 1rem;
		margin: 1rem 0;
	}
	nav a {
		color: #0d47a1;
	}
	.sub {
		color: #555;
		font-size: 0.9rem;
	}
	footer {
		margin-top: 2rem;
		font-size: 0.8rem;
		color: #888;
	}
</style>
