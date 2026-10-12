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
	<a href="/">.NET Config Wizard</a>
</header>

{@render children()}
