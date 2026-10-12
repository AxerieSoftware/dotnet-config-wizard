<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import ValueSelect from '../ui/ValueSelect.svelte';
	import { FORMATTING_GLOBS, FORMATTING_KEYS } from './formattingKeys.ts';

	const wizard = getWizardState();
</script>

<h1>Formatting</h1>
<p class="lead">Encoding, line endings and whitespace for each kind of file. Anything left unset falls back to <code>[*]</code>, then to the editor's own default.</p>

{#each FORMATTING_GLOBS as section (section.glob)}
	<section class="card" aria-labelledby={`glob-${section.glob}`}>
		<h2 id={`glob-${section.glob}`}>{section.title} <code>{section.glob}</code></h2>
		{#if section.note}
			<p class="note">{section.note}</p>
		{/if}
		<div class="field-grid">
			{#each FORMATTING_KEYS as formattingKey (formattingKey.key)}
				<label class="field">
					<span>{formattingKey.label}</span>
					<ValueSelect
						label={`${section.title}: ${formattingKey.label}`}
						value={wizard.rootScope.formatting?.[section.glob]?.[formattingKey.key]}
						values={formattingKey.values}
						unsetLabel="Not set"
						onchange={value => wizard.setFormatting(section.glob, formattingKey.key, value)}
					/>
				</label>
			{/each}
		</div>
	</section>
{/each}
