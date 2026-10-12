<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import SeveritySelect from '../ui/SeveritySelect.svelte';
	import { ACCESSIBILITIES, CAPITALIZATIONS, MODIFIERS, NAMING_TEMPLATES, SYMBOL_KINDS, toRuleName, toSymbolGroupName } from './namingRule.ts';

	const wizard = getWizardState();
	const rules = $derived(wizard.rootScope.naming ?? []);
	const unusedTemplates = $derived(NAMING_TEMPLATES.filter(template => !rules.some(rule => rule.symbols === template.symbols)));

	function toggle(values: string[], value: string, isChecked: boolean): void {
		const index = values.indexOf(value);
		if (isChecked && index === -1) values.push(value);
		if (!isChecked && index !== -1) values.splice(index, 1);
	}
</script>

<h1>Naming</h1>
<p class="lead">
	Naming rules feed IDE1006. Roslyn applies the most specific rule that matches a symbol, so order doesn't matter: a rule for <code>private static readonly</code> fields wins over one for all private
	fields.
</p>

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
			<button type="button" class="secondary" onclick={() => wizard.removeNamingRule(index)}>Remove</button>
		</div>
		<p class="note"><code>{toRuleName(rule)}</code></p>

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
	<p class="note">No naming rules yet. Add one of the common conventions below.</p>
{/each}

<section class="card">
	<h2>Add a rule</h2>
	<div class="actions wrap">
		{#each unusedTemplates as template (template.symbols)}
			<button type="button" class="secondary" onclick={() => wizard.addNamingRule(template)}>{template.symbols.replaceAll('_', ' ')}</button>
		{/each}
	</div>
</section>
