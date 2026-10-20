<script lang="ts">
	import { COMMENT_STYLES, type CommentStyle } from '../analyzers/severityBlocks.ts';
	import { toPresetChanges } from '../config/presetChanges.ts';
	import { toPresetName } from '../config/presets.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import ProjectCleanupCard from '../projects/ProjectCleanupCard.svelte';
	import RepeatedSettingsCard from '../projects/RepeatedSettingsCard.svelte';
	import ValidationList from '../validation/ValidationList.svelte';
	import FileExplorer from './FileExplorer.svelte';
	import { toFolderName } from './fileTree.ts';
	import { NEXT_STEPS_FILE_NAME, toNextSteps } from './nextSteps.ts';

	const COMMENT_STYLE_LABELS: Record<CommentStyle, string> = { none: 'None', idAndTitle: 'Rule ID and title', titleAndLink: 'Rule ID, title and docs link' };

	const wizard = getWizardState();
	const presetChanges = $derived(toPresetChanges(wizard.savedState, wizard.config, wizard.catalog));
	const changesSummary = $derived.by(() => {
		if (presetChanges.length === 0) return 'None: these are the preset as it ships.';
		if (presetChanges.length === 1) return '1 setting differs from the preset.';
		return `${presetChanges.length} settings differ from the preset.`;
	});
	const nextSteps = $derived(toNextSteps(wizard.config, wizard.output.files));
</script>

<header class="step-header">
	<h1>Review and export</h1>
	<p>Fix any problems, then download or share from the top bar.</p>
</header>

<ValidationList issues={wizard.issues} />

<section class="card" aria-labelledby="changes-heading">
	<div class="card-header">
		<h2 id="changes-heading">Changes from {toPresetName(wizard.preset)}</h2>
		<p class="note">
			{changesSummary}
		</p>
	</div>
	{#if presetChanges.length > 0}
		<table class="preset-changes">
			<thead>
				<tr>
					<th>Folder</th>
					<th>Setting</th>
					<th>Preset</th>
					<th>Yours</th>
				</tr>
			</thead>
			<tbody>
				{#each presetChanges as change, index (index)}
					<tr>
						<td><code>{change.folderPath === undefined ? 'repo' : toFolderName(change.folderPath)}</code></td>
						<td>{change.setting}</td>
						<td class="caption">{change.presetValue}</td>
						<td><strong>{change.value}</strong></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

{#if wizard.repo && wizard.repo.projectFiles.length > 0}
	<RepeatedSettingsCard repo={wizard.repo} />
	<ProjectCleanupCard repo={wizard.repo} />
{/if}

<section class="card" aria-labelledby="next-steps-heading">
	<div class="card-header">
		<h2 id="next-steps-heading">Next steps</h2>
		<p class="note">Also in the zip as {NEXT_STEPS_FILE_NAME}.</p>
	</div>
	<ol class="bullets">
		{#each nextSteps as step (step)}
			<li>{step.replaceAll('`', '')}</li>
		{/each}
	</ol>
</section>

<section class="card" aria-labelledby="files-heading">
	<div class="card-header">
		<h2 id="files-heading">Files</h2>
		<label class="field inline">
			<span>Rule comments</span>
			<select bind:value={wizard.commentStyle}>
				{#each COMMENT_STYLES as commentStyle (commentStyle)}
					<option value={commentStyle}>{COMMENT_STYLE_LABELS[commentStyle]}</option>
				{/each}
			</select>
		</label>
	</div>
	<div class="review-explorer"><FileExplorer /></div>
</section>
