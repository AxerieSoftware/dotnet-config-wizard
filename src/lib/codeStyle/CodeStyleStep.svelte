<script lang="ts">
	import type { CatalogOption } from '../catalog/catalog.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import SeveritySelect from '../ui/SeveritySelect.svelte';
	import ValueSelect from '../ui/ValueSelect.svelte';

	const wizard = getWizardState();

	const groups = Map.groupBy(
		wizard.catalog.options
			.values()
			.filter(option => option.languages.includes('csharp'))
			.toArray()
			.sort((left, right) => left.groupOrder - right.groupOrder || left.name.localeCompare(right.name)),
		option => option.groupTitle
	)
		.entries()
		.map(([title, options]) => ({ title, options, rules: toRules(options) }))
		.toArray();

	function toRules(options: CatalogOption[]) {
		return [...new Set(options.flatMap(option => option.ruleIds))]
			.sort()
			.map(id => wizard.catalog.rules.get(id))
			.filter(rule => rule !== undefined);
	}

	function toValueChoices(option: CatalogOption): string[] {
		return [...new Set(option.values.map(value => value.value))];
	}
</script>

<h1>Code style</h1>
<p class="lead">Every C# code-style option, grouped the way the output file groups them. An option says what you prefer; its rule's severity says how loudly to complain.</p>

{#each groups as group (group.title)}
	<section class="card">
		<h2>{group.title}</h2>
		{#each group.options as option (option.name)}
			<div class="option-row">
				<label class="field">
					<code>{option.name}</code>
					{#if option.allowsMultipleValues}
						<input
							aria-label={option.name}
							value={wizard.rootScope.options?.[option.name] ?? ''}
							placeholder={option.defaultValue ?? ''}
							onchange={event => wizard.setOption(option.name, event.currentTarget.value.trim() === '' ? undefined : event.currentTarget.value.trim())}
						>
					{:else}
						<ValueSelect
							label={option.name}
							value={wizard.rootScope.options?.[option.name]}
							values={toValueChoices(option)}
							unsetLabel={option.defaultValue ? `Default (${option.defaultValue})` : 'Default'}
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
			{#each group.rules as rule (rule.id)}
				<div class="rule-row">
					<span><strong>{rule.id}</strong> {rule.title}</span>
					{#if !rule.isEnforcedOnBuild}
						<span class="badge" title="dotnet build never runs this rule; only the editor reports it.">Editor only</span>
					{/if}
					<SeveritySelect ruleId={rule.id} value={wizard.rootScope.severities?.[rule.id]} onchange={severity => wizard.setSeverity(rule.id, severity)} />
				</div>
			{/each}
		{/if}
	</section>
{/each}
