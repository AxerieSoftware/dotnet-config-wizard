<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getBrowserStorage, loadInitialState } from '#lib/config/initialState.ts';
	import WizardShell from '#lib/ui/WizardShell.svelte';

	let { children }: { children: Snippet } = $props();

	// Prerendering has no browser, so the page ships with the loading message and loads its state on arrival.
	const initialState = typeof window === 'undefined' ? undefined : loadInitialState(location, getBrowserStorage());
</script>

{#if initialState}
	{#await initialState}
		<p class="status">Loading rules and options…</p>
	{:then loaded}
		<WizardShell initialState={loaded}>{@render children()}</WizardShell>
	{:catch error}
		<p class="status warning" role="alert">The rule catalog didn't load: {error.message}</p>
	{/await}
{:else}
	<p class="status">Loading rules and options…</p>
{/if}
