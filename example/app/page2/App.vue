<template>
	<div class="page page2">
		<header>
			<h1>Page 2</h1>
			<p class="sub">另一套完整入口（与 page1 完全隔离）</p>
		</header>
		<nav>
			<router-link to="/">首页</router-link>
			<router-link to="/detail">详情</router-link>
		</nav>
		<main>
			<router-view />
		</main>
		<footer>源文件：<code>app/page2/*</code></footer>
	</div>
</template>

<style scoped>
.page {
		max-width: 42rem;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: system-ui, sans-serif;
	}
	.page2 {
		background: #fff8f0;
		min-height: 100vh;
	}
	nav {
		display: flex;
		gap: 1rem;
		margin: 1rem 0;
	}
	nav a {
		color: #bf360c;
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
