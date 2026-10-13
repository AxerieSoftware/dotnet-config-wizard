<script lang="ts">
	import type { CatalogOption } from '../catalog/catalog.ts';
	import CodeBlock from '../ui/CodeBlock.svelte';

	/** What each value of an option does, with the docs example. `value` marks the value in effect. */
	let { option, value }: { option: CatalogOption; value?: string } = $props();

	// An option's value can carry a legacy `:severity` suffix, and multi-value options list several values.
	const currentValues = $derived(
		new Set(
			(value ?? '')
				.split(':')[0]
				.split(',')
				.map(entry => entry.trim())
		)
	);
</script>

<div class="option-help">
	<dl>
		{#each option.values as entry (entry.value)}
			<div class:current={currentValues.has(entry.value)}>
				<dt>
					<code>{entry.value}</code>
					{#if entry.value === option.defaultValue}
						<span class="caption"> default</span>
					{/if}
				</dt>
				<dd>{entry.description}</dd>
			</div>
		{/each}
	</dl>
	{#if option.example}
		<div class="option-example"><CodeBlock code={option.example} /></div>
	{/if}
</div>
