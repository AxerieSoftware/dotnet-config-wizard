<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { findRulesAddedSince } from '../export/whatsNew.ts';
	import Icon from '../ui/Icon.svelte';

	const wizard = getWizardState();
	const newRules = $derived(wizard.importedCatalogVersion ? findRulesAddedSince(wizard.catalog, wizard.importedCatalogVersion, wizard.activeContext) : []);
	let dialog: HTMLDialogElement | undefined = $state();
	// The folder the import goes into, picked from the file tree's menu; the dialog is open while one is set.
	const targetPath = $derived(wizard.importTargetPath ?? '');
	const scopeLabel = $derived(targetPath === '' ? 'the repo root' : `${targetPath}/`);
	let chosenFileNames = $state<string[]>([]);

	async function importChosenFiles(fileList: FileList | null): Promise<void> {
		const files = await Promise.all([...(fileList ?? [])].map(async file => ({ name: file.name, text: await file.text() })));
		chosenFileNames = files.map(file => file.name);
		wizard.importFiles(files);
	}

	$effect(() => {
		if (wizard.importTargetPath === undefined || dialog?.open) return;

		wizard.activeScopePath = wizard.importTargetPath;
		wizard.importNotes = [];
		chosenFileNames = [];
		dialog?.showModal();
	});
</script>

<dialog class="confirm-dialog import-dialog" bind:this={dialog} aria-labelledby="import-title" onclose={() => (wizard.importTargetPath = undefined)}>
	<h2 id="import-title">Import files into {scopeLabel}</h2>
	<p>Reads .editorconfig, .globalconfig, Directory.Build.props, Directory.Packages.props, project files and .ruleset.</p>
	<div class="stack">
		<div class="file-picker">
			<label class="button">
				Choose files
				<input class="visually-hidden" type="file" multiple accept=".editorconfig,.globalconfig,.props,.targets,.csproj,.ruleset" onchange={event => importChosenFiles(event.currentTarget.files)}>
			</label>
			<span class="caption">{chosenFileNames.length > 0 ? chosenFileNames.join(', ') : 'None chosen'}</span>
		</div>
		<p class="caption">Unmaintained analyzers and unknown properties are dropped and listed below.</p>

		{#if wizard.importNotes.length > 0}
			<ul class="issues" aria-label="Import notes">
				{#each wizard.importNotes as note, index (index)}
					<li class={`issue issue-${note.severity}`}>
						<Icon name={note.severity === 'info' ? 'info' : 'warning'} />
						<span class="issue-text"><code>{note.fileName}</code> {note.message}</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if wizard.importedCatalogVersion}
			<section class="stack" aria-labelledby="whats-new-heading">
				<h3 id="whats-new-heading">What's new since your config</h3>
				<p class="note">Your file is from the {wizard.importedCatalogVersion} catalog. These rules arrived since and apply to {scopeLabel}.</p>
				{#if newRules.length === 0}
					<p class="note">No new rules apply.</p>
				{:else}
					<div class="actions">
						<button
							type="button"
							onclick={() =>
								wizard.setSeverities(
									newRules.map(rule => rule.id),
									'warning'
								)}
						>
							Adopt all as warnings
						</button>
					</div>
					<div class="rows">
						{#each newRules as rule (rule.id)}
							<div class="rule-row plain">
								<span><span class="rule-id">{rule.id}</span>{rule.title}<span class="caption">{rule.sourceTitle}</span></span>
								{#if wizard.activeScope.severities?.[rule.id]}
									<span class="badge brand">{wizard.activeScope.severities[rule.id]}</span>
								{:else}
									<button type="button" class="small" onclick={() => wizard.setSeverity(rule.id, 'warning')}>Adopt {rule.id}</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<div class="actions dialog-actions">
			<button type="button" class="primary" onclick={() => dialog?.close()}>Done</button>
		</div>
	</div>
</dialog>
