<script lang="ts">
	import type { Snippet } from 'svelte';
	import favicon from '#lib/assets/favicon.svg';
	import AppHeader from '#lib/ui/AppHeader.svelte';
	import { page } from '$app/state';
	import '@fontsource/cascadia-code/400.css';
	import '@fontsource/cascadia-code/600.css';
	import '../app.css';

	let { children }: { children: Snippet } = $props();

	// The wizard renders its own header, with the export actions that need its state.
	const isWizard = $derived(page.url.pathname.startsWith('/wizard'));
</script>

<svelte:head>
	<link rel="icon" href={favicon}>
</svelte:head>

{#if !isWizard}
	<AppHeader />
{/if}

{@render children()}
