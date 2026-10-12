<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { findRulesAddedSince } from '../export/whatsNew.ts';

	const PASTE_FILE_NAMES = ['.editorconfig', 'Directory.Build.props', 'Directory.Packages.props', 'Analyzers.ruleset'];

	const wizard = getWizardState();
	const newRules = $derived(wizard.importedCatalogVersion ? findRulesAddedSince(wizard.catalog, wizard.importedCatalogVersion, wizard.activeContext) : []);
	const scopeLabel = $derived(wizard.isRootActive ? 'the root' : `${wizard.activeScope.path}/`);
	let pastedText = $state('');
	let pastedFileName = $state(PASTE_FILE_NAMES[0]);

	async function importChosenFiles(fileList: FileList | null): Promise<void> {
		const files = await Promise.all([...(fileList ?? [])].map(async file => ({ name: file.name, text: await file.text() })));
		wizard.importFiles(files);
	}

	function importPastedText(): void {
		wizard.importFiles([{ name: pastedFileName, text: pastedText }]);
		pastedText = '';
	}
</script>

<section class="card">
	<h2>Import existing files</h2>
	<p class="note">
		Imports into {scopeLabel}: .editorconfig, .globalconfig, Directory.Build.props, Directory.Packages.props, project files and .ruleset. Settings from unmaintained analyzers and properties the wizard
		never writes are reported and dropped.
	</p>
	<label class="field">
		<span>Choose files</span>
		<input type="file" multiple accept=".editorconfig,.globalconfig,.props,.targets,.csproj,.ruleset" onchange={event => importChosenFiles(event.currentTarget.files)}>
	</label>
	<div class="field-grid">
		<label class="field">
			<span>Or paste a file</span>
			<select aria-label="Pasted file type" bind:value={pastedFileName}>
				{#each PASTE_FILE_NAMES as fileName (fileName)}
					<option value={fileName}>{fileName}</option>
				{/each}
			</select>
		</label>
	</div>
	<textarea aria-label="Pasted file contents" rows="6" bind:value={pastedText}></textarea>
	<div class="actions">
		<button type="button" class="secondary" disabled={pastedText.trim() === ''} onclick={importPastedText}>Import pasted file</button>
	</div>

	{#if wizard.importNotes.length > 0}
		<ul class="issues" aria-label="Import notes">
			{#each wizard.importNotes as note, index (index)}
				<li class={`issue issue-${note.severity}`}><code>{note.fileName}</code> {note.message}</li>
			{/each}
		</ul>
	{/if}
</section>

{#if wizard.importedCatalogVersion}
	<section class="card" aria-labelledby="whats-new-heading">
		<h2 id="whats-new-heading">What's new since your config</h2>
		<p class="note">Your .editorconfig was made with the catalog from {wizard.importedCatalogVersion}. These rules arrived since and apply to {scopeLabel}.</p>
		{#if newRules.length === 0}
			<p class="note">No new rules apply.</p>
		{:else}
			<div class="actions">
				<button
					type="button"
					class="secondary"
					onclick={() =>
						wizard.setSeverities(
							newRules.map(rule => rule.id),
							'warning'
						)}
				>
					Adopt all as warnings
				</button>
			</div>
			{#each newRules as rule (rule.id)}
				<div class="rule-row">
					<span><strong>{rule.id}</strong> {rule.title} <span class="note">{rule.sourceTitle}</span></span>
					{#if wizard.activeScope.severities?.[rule.id]}
						<span class="badge">{wizard.activeScope.severities[rule.id]}</span>
					{:else}
						<button type="button" class="secondary" onclick={() => wizard.setSeverity(rule.id, 'warning')}>Adopt {rule.id}</button>
					{/if}
				</div>
			{/each}
		{/if}
	</section>
{/if}
