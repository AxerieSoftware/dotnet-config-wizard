<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DEFAULT_BAND, loadCatalog } from '#lib/catalog/loadCatalog.ts';
	import WizardShell from '#lib/ui/WizardShell.svelte';

	let { children }: { children: Snippet } = $props();
</script>

{#await loadCatalog(DEFAULT_BAND.band)}
	<p class="status">Loading rules and options…</p>
{:then catalog}
	<WizardShell {catalog}>{@render children()}</WizardShell>
{:catch error}
	<p class="status warning" role="alert">The rule catalog didn't load: {error.message}</p>
{/await}
