<script lang="ts">
	import { BUILD_PROPS } from '../build/buildPropsFiles.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { toFolderName } from '../export/fileTree.ts';
	import type { RepoConnection } from '../repo/repoConnection.svelte.ts';
	import { findRepeatedSettings } from './repeatedSettings.ts';

	let { repo }: { repo: RepoConnection } = $props();

	const wizard = getWizardState();
	const settings = $derived(findRepeatedSettings(wizard.config, repo.projectFiles, { packagesPropsText: undefined, readText: path => repo.readDiskText(path) }));

	function toFolderLabel(folderPath: string): string {
		return folderPath === '' ? 'the repo root' : toFolderName(folderPath);
	}
</script>

{#if settings.length > 0}
	<section class="card" aria-labelledby="repeated-settings-heading">
		<div class="card-header">
			<h2 id="repeated-settings-heading">Repeated settings</h2>
			<p class="note">Each project these folders reach sets the same value. Set it for the folder, then remove the projects' lines under Project files.</p>
		</div>

		<ul class="settings">
			{#each settings as setting (`${setting.folderPath}:${setting.name}`)}
				<li>
					<span>
						<code>&lt;{setting.name}&gt;{setting.value}&lt;/{setting.name}&gt;</code>
						<span class="caption">
							In {setting.projectPaths.length} projects under {toFolderLabel(setting.folderPath)}{setting.isNewFolder ? `, which gets its own ${BUILD_PROPS}` : ''}:
							{setting.projectPaths.join(', ')}
						</span>
					</span>
					<button type="button" class="small" onclick={() => wizard.setFolderSetting(setting.folderPath, setting.name, setting.value)}>
						{setting.isNewFolder ? `Add ${toFolderLabel(setting.folderPath)} and set it` : `Set for ${toFolderLabel(setting.folderPath)}`}
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.settings li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 16px;
	}

	.settings li > span {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-width: 0;
	}
</style>
