<script lang="ts">
	import type { CatalogOption, CatalogRule } from '../catalog/catalog.ts';
	import { getOptionBlocker, getRuleBlocker } from '../config/versionGates.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { toUnsetLabel } from '../ui/inheritedLabel.ts';
	import SeveritySelect from '../ui/SeveritySelect.svelte';
	import ValueSelect from '../ui/ValueSelect.svelte';

	const wizard = getWizardState();
	let isUnavailableShown = $state(false);

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

	function toValueChoices(option: CatalogOption): string[] {
		return [...new Set(option.values.map(value => value.value))];
	}
</script>

<h1>Code style</h1>
<p class="lead">Every C# code-style option, grouped the way the output file groups them. An option says what you prefer; its rule's severity says how loudly to complain.</p>

<label class="checkbox toggle">
	<input type="checkbox" bind:checked={isUnavailableShown}>
	Show options and rules that need a newer C# version or framework than C# {wizard.activeContext.csharpVersion} and {wizard.activeContext.tfms.join(', ')}
</label>

{#each groups as group (group.title)}
	<section class="card">
		<h2>{group.title}</h2>
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
							onchange={value => wizard.setOption(option.name, value)}
						/>
					{/if}
				</label>
				{#if option.example}
					<details>
						<summary>Example</summary>
						<pre><code>{option.example}</code></pre>
					</details>
				{/if}
			</div>
		{/each}

		{#if group.rules.length > 0}
			<h3>Rules</h3>
			{#each group.rules as { rule, blocker } (rule.id)}
				<div class="rule-row" class:unavailable={blocker}>
					<span><strong>{rule.id}</strong> {rule.title}</span>
					{#if blocker}
						<span class="badge">{blocker}</span>
					{:else if !rule.isEnforcedOnBuild}
						<span class="badge" title="dotnet build never runs this rule; only the editor reports it.">Editor only</span>
					{/if}
					<SeveritySelect
						ruleId={rule.id}
						disabled={Boolean(blocker)}
						value={wizard.activeScope.severities?.[rule.id]}
						inheritedValue={wizard.inheritedScope?.severities[rule.id]}
						onchange={severity => wizard.setSeverity(rule.id, severity)}
					/>
				</div>
			{/each}
		{/if}
	</section>
{/each}
