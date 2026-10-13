<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { toUnsetLabel } from '../ui/inheritedLabel.ts';
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
		return wizard.activeScope.build?.[property.name] ?? wizard.activeScope.ciBuild?.[property.name];
	}

	function getInheritedValue(property: BuildProperty): string | undefined {
		return wizard.inheritedScope?.build[property.name] ?? wizard.inheritedScope?.ciBuild[property.name];
	}

	function isLocked(property: BuildProperty): boolean {
		return Boolean(property.isRepoWide) && !wizard.isRootActive;
	}
</script>

{#each groups as [group, groupProperties] (group)}
	<section class="card">
		<h2>{group}</h2>
		<div class="rows">
			{#each groupProperties as property (property.name)}
				<div class="option-row">
					<label class="field">
						<span class="option-name">
							<code>{property.name}</code>
							{#if isLocked(property)}
								<span class="badge">Set on the repo root</span>
							{/if}
						</span>
						{#if property.values.length > 0}
							<ValueSelect
								label={property.name}
								disabled={isLocked(property)}
								value={getValue(property)}
								values={property.values}
								unsetLabel={toUnsetLabel(getInheritedValue(property), 'Not set')}
								fallbackValue={getInheritedValue(property)}
								onchange={value => wizard.setPropertyValue(property.name, value)}
							/>
						{:else}
							<input
								aria-label={property.name}
								disabled={isLocked(property)}
								class:changed={getValue(property) !== undefined && getValue(property) !== getInheritedValue(property)}
								value={getValue(property) ?? ''}
								placeholder={getInheritedValue(property) ?? property.example ?? ''}
								onchange={event => wizard.setPropertyValue(property.name, event.currentTarget.value.trim() || undefined)}
							>
						{/if}
					</label>
					<p class="description">
						{#each property.description.split('`') as part, partIndex (partIndex)}
							{#if partIndex % 2 === 1}
								<code>{part}</code>
							{:else}
								{part}
							{/if}
						{/each}
						{property.isList ? ' Separate entries with semicolons; they add to the inherited list.' : ''}
					</p>
					{#if property.canBeCiOnly}
						<label class="checkbox ci-only">
							<input
								type="checkbox"
								disabled={getValue(property) === undefined}
								checked={wizard.activeScope.ciBuild?.[property.name] !== undefined}
								onchange={event => wizard.setCiOnly(property.name, event.currentTarget.checked)}
							>
							CI builds only
						</label>
					{/if}
				</div>
			{/each}
		</div>
	</section>
{/each}
