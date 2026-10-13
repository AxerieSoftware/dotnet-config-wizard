<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import SeveritySelect from '../ui/SeveritySelect.svelte';
	import { ACCESSIBILITIES, CAPITALIZATIONS, MICROSOFT_NAMING_SYMBOLS, MODIFIERS, NAMING_TEMPLATES, SYMBOL_KINDS, toRuleName, toSymbolGroupName } from './namingRule.ts';

	const wizard = getWizardState();
	const rules = $derived(wizard.activeScope.naming ?? []);
	const ownSymbols = $derived(new Set(rules.map(rule => rule.symbols)));
	const inheritedRules = $derived((wizard.inheritedScope?.naming ?? []).filter(rule => !ownSymbols.has(rule.symbols)));
	const unusedTemplates = $derived(NAMING_TEMPLATES.filter(template => !wizard.resolvedActiveScope.naming.some(rule => rule.symbols === template.symbols)));

	function addMicrosoftConventions(): void {
		for (const template of unusedTemplates.filter(entry => MICROSOFT_NAMING_SYMBOLS.includes(entry.symbols))) wizard.addNamingRule(template);
	}

	function toggle(values: string[], value: string, isChecked: boolean): void {
		const index = values.indexOf(value);
		if (isChecked && index === -1) values.push(value);
		if (!isChecked && index !== -1) values.splice(index, 1);
	}
</script>

<header class="step-header">
	<h1>Naming</h1>
	<p>Rules for IDE1006. The most specific match wins.</p>
</header>

<section class="card">
	<div class="card-header">
		<h2>Add a rule</h2>
		<p class="note">Microsoft conventions: PascalCase types and members, <code>I</code>/<code>T</code> prefixes, <code>_camelCase</code> and <code>s_camelCase</code> fields.</p>
	</div>
	<div class="actions">
		<button type="button" class="primary" onclick={addMicrosoftConventions}>Add Microsoft conventions</button>
		{#each unusedTemplates as template (template.symbols)}
			<button type="button" onclick={() => wizard.addNamingRule(template)}>{template.symbols.replaceAll('_', ' ')}</button>
		{/each}
	</div>
</section>

{#if inheritedRules.length > 0}
	<section class="card">
		<div class="card-header">
			<h2>Inherited rules</h2>
			<p class="note">From the folder above. A rule with the same symbol group replaces one.</p>
		</div>
		<div class="rows">
			{#each inheritedRules as rule (rule.symbols)}
				<div class="rule-row plain unavailable"><code>{toRuleName(rule)}</code></div>
			{/each}
		</div>
	</section>
{/if}

{#each rules as rule, index (index)}
	<section class="card naming-rule" aria-label={`Naming rule ${rule.symbols}`}>
		<div class="naming-rule-header">
			<label class="field">
				<span>Symbol group name</span>
				<input aria-label="Symbol group name" value={rule.symbols} onchange={event => (rule.symbols = toSymbolGroupName(event.currentTarget.value) || rule.symbols)}>
			</label>
			<label class="field">
				<span>Severity</span>
				<SeveritySelect ruleId={rule.symbols} value={rule.severity} onchange={severity => (rule.severity = severity ?? 'suggestion')} />
			</label>
			<button type="button" class="subtle" onclick={() => wizard.removeNamingRule(index)}>Remove</button>
		</div>
		<p class="caption mono">{toRuleName(rule)}</p>

		<fieldset>
			<legend>Symbol kinds</legend>
			{#each SYMBOL_KINDS as kind (kind)}
				<label class="checkbox"><input type="checkbox" checked={rule.applicableKinds.includes(kind)} onchange={event => toggle(rule.applicableKinds, kind, event.currentTarget.checked)}> {kind}</label>
			{/each}
		</fieldset>
		<fieldset>
			<legend>Accessibilities</legend>
			{#each ACCESSIBILITIES as accessibility (accessibility)}
				<label class="checkbox"
					><input
						type="checkbox"
						checked={rule.applicableAccessibilities.includes(accessibility)}
						onchange={event => toggle(rule.applicableAccessibilities, accessibility, event.currentTarget.checked)}
					> {accessibility}</label
				>
			{/each}
		</fieldset>
		<fieldset>
			<legend>Required modifiers</legend>
			{#each MODIFIERS as modifier (modifier)}
				<label class="checkbox"
					><input type="checkbox" checked={rule.requiredModifiers.includes(modifier)} onchange={event => toggle(rule.requiredModifiers, modifier, event.currentTarget.checked)}> {modifier}</label
				>
			{/each}
		</fieldset>

		<div class="field-grid">
			<label class="field">
				<span>Capitalization</span>
				<select bind:value={rule.capitalization}>
					{#each CAPITALIZATIONS as capitalization (capitalization)}
						<option value={capitalization}>{capitalization}</option>
					{/each}
				</select>
			</label>
			<label class="field"><span>Required prefix</span><input bind:value={rule.requiredPrefix}></label>
			<label class="field"><span>Required suffix</span><input bind:value={rule.requiredSuffix}></label>
			<label class="field"><span>Word separator</span><input bind:value={rule.wordSeparator}></label>
		</div>
	</section>
{:else}
	<p class="note">No naming rules yet.</p>
{/each}
