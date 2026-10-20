<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { PACKAGES_PROPS } from '../build/buildPropsFiles.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { toReadOnlyReason } from '../repo/openRepo.ts';
	import type { ApplyResult, RepoConnection } from '../repo/repoConnection.svelte.ts';
	import Icon from '../ui/Icon.svelte';
	import { findProjectCleanup, type ProjectEdit } from './projectCleanup.ts';

	let { repo }: { repo: RepoConnection } = $props();

	const wizard = getWizardState();
	const packagesProps = $derived(wizard.output.files.find(file => file.path === PACKAGES_PROPS));
	const cleanup = $derived(
		findProjectCleanup(wizard.config, wizard.catalog, repo.projectFiles, {
			packagesPropsText: packagesProps && repo.toSavedFileText(packagesProps, wizard.catalog),
			readText: path => repo.readDiskText(path)
		})
	);
	const projectCount = $derived(repo.projectFiles.filter(project => project.path.endsWith('.csproj')).length);
	const projectPaths = $derived([...new Set([...cleanup.edits, ...cleanup.keptLines].map(line => line.projectPath))].sort());
	// Every edit starts chosen. Declined ones are remembered by their text, so they stay declined after other lines go.
	const declinedKeys = new SvelteSet<string>();
	const chosenEdits = $derived(cleanup.edits.filter(edit => !declinedKeys.has(toKey(edit))));
	// A result describes the files as they were when it was applied, so it's shown only until the settings change.
	let applied = $state.raw<{ result: ApplyResult; output: typeof wizard.output } | undefined>(undefined);
	const result = $derived(applied?.output === wizard.output ? applied.result : undefined);
	let isApplying = $state(false);

	function toKey(edit: ProjectEdit): string {
		return `${edit.projectPath}\n${edit.line}`;
	}

	async function apply(edits: readonly ProjectEdit[]): Promise<void> {
		isApplying = true;
		applied = { result: await repo.applyProjectEdits(edits, packagesProps, wizard.catalog), output: wizard.output };
		isApplying = false;
	}

	function toAppliedMessage(projectCount: number, isPackagesPropsChanged: boolean): string {
		const projects = projectCount === 1 ? '1 project file' : `${projectCount} project files`;
		return isPackagesPropsChanged ? `Updated ${projects} and ${PACKAGES_PROPS}.` : `Updated ${projects}.`;
	}
</script>

<section class="card" aria-labelledby="project-cleanup-heading">
	<div class="card-header">
		<h2 id="project-cleanup-heading">Project files</h2>
		<p class="note">
			Lines in your <code>.csproj</code> files that the generated files or the compiler's defaults make unnecessary. Lines in conditional groups aren't touched. Review each change, then apply the ones
			you want.
		</p>
	</div>

	{#if result?.status === 'applied'}
		<p class="message success" role="status"><Icon name="checkmarkCircle" /><span>{toAppliedMessage(result.projectCount, result.isPackagesPropsChanged)}</span></p>
	{:else if result?.status === 'changed-on-disk'}
		<p class="message warning" role="status"><Icon name="warning" /><span>Files changed on disk since they were read, so nothing was written. Review the list again.</span></p>
	{:else if result?.status === 'failed'}
		<p class="message danger" role="alert"><Icon name="errorCircle" /><span>Not every file was saved: {result.message}</span></p>
	{/if}

	{#if projectPaths.length === 0}
		<p class="note">Nothing in the {projectCount === 1 ? 'project file' : `${projectCount} project files`} is unnecessary now.</p>
	{:else}
		{#each projectPaths as projectPath (projectPath)}
			<fieldset class="project">
				<legend><code>{projectPath}</code></legend>
				{#each cleanup.edits.filter(edit => edit.projectPath === projectPath) as edit (edit.lineIndex)}
					<label class="checkbox">
						<input
							type="checkbox"
							aria-label={`${edit.movedVersion ? 'Move the version from' : 'Remove'} ${edit.line} in ${projectPath}`}
							checked={!declinedKeys.has(toKey(edit))}
							onchange={event => (event.currentTarget.checked ? declinedKeys.delete(toKey(edit)) : declinedKeys.add(toKey(edit)))}
						>
						<span>
							<code>{edit.line}</code>
							<span class="caption">{edit.movedVersion ? 'Move the version. ' : 'Remove. '}{edit.reason}</span>
						</span>
					</label>
				{/each}
				{#each cleanup.keptLines.filter(kept => kept.projectPath === projectPath) as kept (kept.lineIndex)}
					<p class="kept">
						<code>{kept.line}</code>
						<span class="caption">Kept. {kept.reason}</span>
					</p>
				{/each}
			</fieldset>
		{/each}

		{#if cleanup.edits.length > 0}
			<div class="actions">
				<button type="button" class="primary" disabled={repo.status !== 'saved' || isApplying || chosenEdits.length === 0} onclick={() => void apply(chosenEdits)}>
					Apply {chosenEdits.length === 1 ? '1 change' : `${chosenEdits.length} changes`}
				</button>
				{#if !repo.canWrite}
					<span class="caption">{toReadOnlyReason()} Until then, make these changes by hand.</span>
				{:else if repo.status === 'failed'}
					<span class="caption">The generated files didn't save, and these changes rely on them. Fix that first.</span>
				{:else if repo.status === 'saving'}
					<span class="caption">Waits for the generated files to save first, since these changes rely on them.</span>
				{/if}
			</div>
		{/if}
	{/if}
</section>

<style>
	.project {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		border: none;
	}

	.project legend {
		padding: 0;
		margin-bottom: 8px;
		font-weight: 600;
	}

	.project .checkbox > span,
	.kept {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
	}

	/* Lines up with the text of the checkbox rows. */
	.kept {
		padding-left: 21px;
	}
</style>
