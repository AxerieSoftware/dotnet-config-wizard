<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import ValueSelect from '../ui/ValueSelect.svelte';
	import type { BuildProperty } from './buildProperties.ts';

	let { properties }: { properties: readonly BuildProperty[] } = $props();

	const wizard = getWizardState();
	const groups = $derived(
		Map.groupBy(properties, property => property.group)
			.entries()
			.toArray()
	);

	function getValue(property: BuildProperty): string | undefined {
		return wizard.rootScope.build?.[property.name] ?? wizard.rootScope.ciBuild?.[property.name];
	}
</script>

{#each groups as [group, groupProperties] (group)}
	<section class="card">
		<h2>{group}</h2>
		{#each groupProperties as property (property.name)}
			<div class="option-row">
				<label class="field">
					<span class="option-name"><code>{property.name}</code></span>
					{#if property.values.length > 0}
						<ValueSelect label={property.name} value={getValue(property)} values={property.values} unsetLabel="Not set" onchange={value => wizard.setPropertyValue(property.name, value)} />
					{:else}
						<input
							aria-label={property.name}
							value={getValue(property) ?? ''}
							placeholder={property.example ?? ''}
							onchange={event => wizard.setPropertyValue(property.name, event.currentTarget.value.trim() || undefined)}
						>
					{/if}
				</label>
				<p class="note">{property.description}{property.isList ? ' Separate entries with semicolons; they add to any inherited list.' : ''}</p>
				{#if property.canBeCiOnly}
					<label class="checkbox">
						<input
							type="checkbox"
							disabled={getValue(property) === undefined}
							checked={wizard.rootScope.ciBuild?.[property.name] !== undefined}
							onchange={event => wizard.setCiOnly(property.name, event.currentTarget.checked)}
						>
						CI builds only
					</label>
				{/if}
			</div>
		{/each}
	</section>
{/each}
