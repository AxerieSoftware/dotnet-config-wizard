<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getEffectiveSeverity } from '../analyzers/effectiveSeverity.ts';
	import type { CatalogOption, CatalogRule } from '../catalog/catalog.ts';
	import { getOptionBlocker, getRuleBlocker } from '../config/versionGates.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { toUnsetLabel } from '../ui/inheritedLabel.ts';
	import SeveritySelect from '../ui/SeveritySelect.svelte';
	import ValueSelect from '../ui/ValueSelect.svelte';
	import OptionHelp from './OptionHelp.svelte';

	const wizard = getWizardState();
	let isUnavailableShown = $state(false);
	// An example renders the first time its section opens, so the step doesn't highlight a hundred snippets nobody reads.
	const openedExamples = new SvelteSet<string>();

	const groups = $derived(
		Map.groupBy(
			wizard.catalog.options
				.values()
				.filter(option => option.languages.includes('csharp'))
				.map(option => ({ option, blocker: getOptionBlocker(option, wizard.activeContext) }))
				.filter(entry => isUnavailableShown || !entry.blocker)
				.toArray()
				.sort((left, right) => left.option.groupOrder - right.option.groupOrder || left.option.name.localeCompare(right.option.name)),
			entry => entry.option.groupTitle
		)
			.entries()
			.map(([title, entries]) => ({ title, entries, rules: toRules(entries.map(entry => entry.option)) }))
			.toArray()
	);

	function toRules(options: CatalogOption[]): { rule: CatalogRule; blocker: string | undefined }[] {
		return [...new Set(options.flatMap(option => option.ruleIds))]
			.sort()
			.map(id => wizard.catalog.rules.get(id))
			.filter(rule => rule !== undefined)
			.map(rule => ({ rule, blocker: getRuleBlocker(rule, wizard.activeContext) }))
			.filter(entry => isUnavailableShown || !entry.blocker);
	}

	function toFallbackValue(option: CatalogOption): string | undefined {
		return wizard.inheritedScope?.options[option.name] ?? option.defaultValue ?? undefined;
	}

	function isOptionChanged(option: CatalogOption): boolean {
		const value = wizard.activeScope.options?.[option.name];
		return value !== undefined && value !== toFallbackValue(option);
	}

	function toValueChoices(option: CatalogOption): string[] {
		return [...new Set(option.values.map(value => value.value))];
	}
</script>

<header class="step-header">
	<h1>Code style</h1>
	<p>The option picks the style; its rule's severity sets how the build reports it.</p>
</header>

<label class="checkbox">
	<input type="checkbox" bind:checked={isUnavailableShown}>
	Show options and rules that need more than C# {wizard.activeContext.csharpVersion} ({wizard.activeContext.tfms.join(', ')})
</label>

{#each groups as group (group.title)}
	<section class="card">
		<h2>{group.title}</h2>
		<div class="rows">
			{#each group.entries as { option, blocker } (option.name)}
				<div class="option-row" class:unavailable={blocker}>
					<label class="field">
						<span class="option-name">
							<code>{option.name}</code>
							{#if blocker}
								<span class="badge">{blocker}</span>
							{/if}
						</span>
						{#if option.allowsMultipleValues}
							<input
								aria-label={option.name}
								disabled={Boolean(blocker)}
								class:changed={isOptionChanged(option)}
								value={wizard.activeScope.options?.[option.name] ?? ''}
								placeholder={wizard.inheritedScope?.options[option.name] ?? option.defaultValue ?? ''}
								onchange={event => wizard.setOption(option.name, event.currentTarget.value.trim() === '' ? undefined : event.currentTarget.value.trim())}
							>
						{:else}
							<ValueSelect
								label={option.name}
								disabled={Boolean(blocker)}
								value={wizard.activeScope.options?.[option.name]}
								values={toValueChoices(option)}
								unsetLabel={toUnsetLabel(wizard.inheritedScope?.options[option.name], option.defaultValue ? `Default (${option.defaultValue})` : 'Default')}
								fallbackValue={toFallbackValue(option)}
								onchange={value => wizard.setOption(option.name, value)}
							/>
						{/if}
					</label>
					{#if option.values.length > 0 || option.example}
						<details ontoggle={() => openedExamples.add(option.name)}>
							<summary>Example</summary>
							{#if openedExamples.has(option.name)}
								<OptionHelp {option} value={wizard.activeScope.options?.[option.name] ?? toFallbackValue(option)} />
							{/if}
						</details>
					{/if}
				</div>
			{/each}
		</div>

		{#if group.rules.length > 0}
			<h3>Rules</h3>
			<div class="rows">
				{#each group.rules as { rule, blocker } (rule.id)}
					<div class="rule-row" class:unavailable={blocker}>
						<span>
							<span class="rule-id">{rule.id}</span>
							{rule.title}
							{#if blocker}
								<span class="badge">{blocker}</span>
							{:else if !rule.isEnforcedOnBuild}
								<span class="badge" title="dotnet build never runs this rule; only the editor reports it.">Editor only</span>
							{/if}
						</span>
						<SeveritySelect
							ruleId={rule.id}
							disabled={Boolean(blocker)}
							value={wizard.activeScope.severities?.[rule.id]}
							inheritedValue={wizard.inheritedScope?.severities[rule.id]}
							unsetValue={getEffectiveSeverity(rule, wizard.resolvedActiveScope, wizard.catalog)}
							onchange={severity => wizard.setSeverity(rule.id, severity)}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/each}
