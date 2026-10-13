<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { toUnsetLabel } from '../ui/inheritedLabel.ts';
	import ValueSelect from '../ui/ValueSelect.svelte';
	import { findFormattingFallback } from './formattingFallback.ts';
	import { FORMATTING_GLOBS, FORMATTING_KEYS } from './formattingKeys.ts';
	import { ALL_FILES_GLOB } from './formattingSections.ts';

	const wizard = getWizardState();
	const indentHints = $derived(new Map(FORMATTING_GLOBS.map(section => [section.glob, toIndentHint(section.glob)])));

	/** Names where an unset value comes from: a wildcard section such as `[*]`, a folder above, or nowhere. */
	function toFallbackLabel(glob: string, key: string): string {
		const fallback = findFormattingFallback(wizard.config, wizard.activeScope, glob, key);
		if (fallback && fallback.glob !== glob) return `From ${fallback.glob} (${fallback.value})`;

		return toUnsetLabel(fallback?.value, 'Not set');
	}

	/** How indent size and tab width work with the indent style, shown for [*] and on file types that indent differently. */
	function toIndentHint(glob: string): string | undefined {
		const indentStyle = toIndentStyle(glob);
		if (glob !== ALL_FILES_GLOB && indentStyle === toIndentStyle(ALL_FILES_GLOB)) return undefined;
		if (indentStyle === 'tab') return 'Tabs: keep indent size and tab width equal; the .NET formatter reads both.';
		if (indentStyle === 'space') return 'Spaces: tab width can stay unset.';

		return undefined;
	}

	function toIndentStyle(glob: string): string | undefined {
		return wizard.activeScope.formatting?.[glob]?.indent_style ?? findFormattingFallback(wizard.config, wizard.activeScope, glob, 'indent_style')?.value;
	}
</script>

<header class="step-header">
	<h1>Formatting</h1>
	<p>Encoding, line endings and whitespace per file type.</p>
</header>

{#each FORMATTING_GLOBS as section (section.glob)}
	{@const indentHint = indentHints.get(section.glob)}
	<section class="card" aria-labelledby={`glob-${section.glob}`}>
		<div class="card-header">
			<h2 id={`glob-${section.glob}`}>{section.title}</h2>
			<code class="caption">{section.glob}</code>
		</div>
		<div class="field-grid">
			{#each FORMATTING_KEYS as formattingKey (formattingKey.key)}
				<label class="field">
					<span>{formattingKey.label}</span>
					<ValueSelect
						label={`${section.title}: ${formattingKey.label}`}
						value={wizard.activeScope.formatting?.[section.glob]?.[formattingKey.key]}
						values={formattingKey.values}
						unsetLabel={toFallbackLabel(section.glob, formattingKey.key)}
						fallbackValue={findFormattingFallback(wizard.config, wizard.activeScope, section.glob, formattingKey.key)?.value}
						onchange={value => wizard.setFormatting(section.glob, formattingKey.key, value)}
					/>
				</label>
			{/each}
		</div>
		{#if indentHint}
			<p class="caption">{indentHint}</p>
		{/if}
	</section>
{/each}
