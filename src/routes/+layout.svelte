<script lang="ts">
	import type { Snippet } from 'svelte';
	import favicon from '#lib/assets/favicon.svg';
	import '../app.css';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon}>
</svelte:head>

<header class="site-header">
	<a class="site-title" href="/">.NET Config Wizard</a>
	<nav aria-label="Site">
		<a href="/wizard/start">Wizard</a>
		<a href="/rules">Rules</a>
		<a href="/options">Options</a>
	</nav>
</header>

{@render children()}
