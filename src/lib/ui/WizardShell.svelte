<script lang="ts">
	import { type Snippet, tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import type { InitialState } from '../config/initialState.ts';
	import { getBrowserStorage, restoreReplaced, saveState, startOver } from '../config/initialState.ts';
	import { setWizardState, WizardState } from '../config/wizardState.svelte.ts';
	import ExportActions from '../export/ExportActions.svelte';
	import FileExplorer from '../export/FileExplorer.svelte';
	import { toFolderPath } from '../export/fileTree.ts';
	import { findSettingLine } from '../export/lineInfo.ts';
	import ImportDialog from '../import/ImportDialog.svelte';
	import { toReadOnlyReason } from '../repo/openRepo.ts';
	import RepoButton from '../repo/RepoButton.svelte';
	import AddFolderDialog from './AddFolderDialog.svelte';
	import AppHeader from './AppHeader.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import EditingFolder from './EditingFolder.svelte';
	import Icon from './Icon.svelte';
	import PaneResizer from './PaneResizer.svelte';
	import { SessionValue } from './sessionValue.svelte.ts';
	import { STEP_PATHS, WIZARD_STEPS } from './wizardSteps.ts';

	const PREVIEW_MIN_WIDTH = 320;
	const PREVIEW_MAX_SHARE = 0.7;

	type Props = { initialState: InitialState; children: Snippet };

	let { initialState, children }: Props = $props();

	// The layout loads the initial state once, so the wizard state is created once.
	const wizard = setWizardState(new WizardState(untrack(() => initialState)));

	const storage = getBrowserStorage();
	$effect(() => {
		wizard.isSavedInBrowser = saveState(storage, wizard.isUntouched ? undefined : wizard.savedState);
	});

	// An open repo folder saves edits to disk as they happen.
	$effect(() => {
		const files = wizard.output.files;
		const repo = wizard.repo;
		if (repo) untrack(() => repo.scheduleSave(files, wizard.catalog));
	});

	const stepIndex = $derived(WIZARD_STEPS.findIndex(step => step.path === page.url.pathname));
	const previousStep = $derived(stepIndex > 0 ? WIZARD_STEPS[stepIndex - 1] : undefined);
	const nextStep = $derived(stepIndex < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[stepIndex + 1] : undefined);
	const problemCount = $derived(wizard.issues.filter(issue => issue.severity !== 'info').length);
	const isPreviewShown = $derived(!WIZARD_STEPS[stepIndex]?.isWide);
	const isRepoWide = $derived(WIZARD_STEPS[stepIndex]?.isRepoWide ?? false);
	// A collapsed step list shows icons only and opens over the page while hovered or focused.
	const isNavCollapsed = new SessionValue('nav-collapsed', true, { isLasting: true });
	// Settings opened from a share link are announced until dismissed.
	let isLinkNoticeDismissed = $state(false);
	const isLinkNoticeShown = $derived(initialState.source === 'link' && !isLinkNoticeDismissed);

	// The settings and the preview split the page evenly until the divider is dragged; that width is then remembered,
	// and double-clicking the divider returns to the even split.
	const previewWidth = new SessionValue<number | null>('preview-split', null, { isLasting: true, isValid: value => value === null || typeof value === 'number' });
	let previewOffsetWidth = $state(0);

	function resizePreview(width: number): void {
		previewWidth.value = Math.round(Math.max(PREVIEW_MIN_WIDTH, Math.min(width, window.innerWidth * PREVIEW_MAX_SHARE)));
	}

	/**
	 * Points the preview at the line a setting writes when its control is focused or changed. A change can add the line,
	 * so the files are read again once they've updated.
	 */
	async function linkSetting(event: Event): Promise<void> {
		const control = event.target;
		if (!(control instanceof Element) || !control.matches('select, input, textarea')) return;

		if (event.type === 'change') await tick();
		const folderFiles = wizard.output.files.filter(file => toFolderPath(file.path) === wizard.activeScopePath);
		const linked = findSettingLine(folderFiles, control, wizard.catalog);
		if (linked) wizard.linkedLine = linked;
	}

	function askToStartOver(): void {
		wizard.confirmIfChanged({ title: 'Start over?', message: 'Clears every setting and returns to Microsoft defaults.', confirmLabel: 'Start over' }, () => startOver(location, storage));
	}
</script>

<AppHeader>
	{#snippet actions()}
		<RepoButton />
		{#if !wizard.isUntouched || wizard.repo}
			<button type="button" class="subtle" onclick={askToStartOver}>
				<Icon name="arrowCounterclockwise" /><span class="label">Start over</span>
			</button>
		{/if}
		<ExportActions />
	{/snippet}
</AppHeader>

<div
	class="wizard"
	class:without-preview={!isPreviewShown}
	class:nav-collapsed={isNavCollapsed.value}
	class:preview-sized={isPreviewShown && previewWidth.value !== null}
	style:--preview-width={previewWidth.value === null ? undefined : `${previewWidth.value}px`}
>
	<nav class="step-nav" class:collapsed={isNavCollapsed.value} aria-label="Wizard steps">
		<div class="step-nav-panel">
			<ol>
				{#each WIZARD_STEPS as step (step.path)}
					<li>
						<a href={step.path} aria-current={step.path === page.url.pathname ? 'page' : undefined}>
							<Icon name={step.icon} />
							<span class="step-label">{step.title}</span>
							{#if step.path === STEP_PATHS.review && problemCount > 0}
								<span class="badge warning">{problemCount}<span class="visually-hidden"> problems</span></span>
							{/if}
						</a>
					</li>
				{/each}
			</ol>
			<button type="button" class="subtle nav-toggle" onclick={() => (isNavCollapsed.value = !isNavCollapsed.value)}>
				<Icon name={isNavCollapsed.value ? 'panelLeftExpand' : 'panelLeftContract'} />
				<span class="step-label">{isNavCollapsed.value ? 'Keep sidebar open' : 'Collapse sidebar'}</span>
			</button>
		</div>
	</nav>

	<main class="step-main" onfocusin={linkSetting} onchange={linkSetting}>
		{#if wizard.repo && wizard.openedRepoSummary}
			<div class="message" role="status">
				<Icon name="folderOpen" />
				<span>
					Opened {wizard.repo.name}: {wizard.openedRepoSummary.fileCount} config files in {wizard.openedRepoSummary.folderCount}
					{wizard.openedRepoSummary.folderCount === 1 ? 'folder' : 'folders'}.{wizard.repo.status === 'read-only' ? ` ${toReadOnlyReason()}` : ' Edits save automatically.'}
					{#if wizard.importNotes.length > 0}
						<details class="repo-notes">
							<summary>{wizard.importNotes.length} notes about what was loaded</summary>
							<ul class="issues" aria-label="Import notes">
								{#each wizard.importNotes as note, index (index)}
									<li class={`issue issue-${note.severity}`}>
										<Icon name={note.severity === 'info' ? 'info' : 'warning'} />
										<span class="issue-text"><code>{note.fileName}</code> {note.message}</span>
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				</span>
				<button type="button" class="subtle small" onclick={() => (wizard.openedRepoSummary = undefined)}>Dismiss</button>
			</div>
		{/if}
		{#if wizard.repo?.status === 'failed'}
			<p class="message danger" role="alert">
				<Icon name="errorCircle" />
				<span>Couldn't save to {wizard.repo.name}: {wizard.repo.failure}. The next edit retries.</span>
			</p>
		{/if}
		{#if isLinkNoticeShown}
			<p class="message" role="status">
				<Icon name="link" />
				<span>Opened settings from a share link.{initialState.replacedSaved ? ' They replaced the settings you had saved in this browser.' : ''}</span>
				{#if initialState.replacedSaved}
					{@const replacedSaved = initialState.replacedSaved}
					<button type="button" class="small" onclick={() => restoreReplaced(location, storage, replacedSaved)}>Restore my settings</button>
				{/if}
				<button type="button" class="subtle small" onclick={() => (isLinkNoticeDismissed = true)}>Dismiss</button>
			</p>
		{/if}
		{#if wizard.notice}
			<p class="message warning" role="status">
				<Icon name="warning" />
				<span>{wizard.notice}</span>
				<button type="button" class="subtle small" onclick={() => (wizard.notice = undefined)}>Dismiss</button>
			</p>
		{/if}
		{#if !isRepoWide}
			<EditingFolder />
		{/if}
		{@render children()}
		<div class="step-footer">
			{#if previousStep}
				<a class="button" href={previousStep.path}><Icon name="arrowLeft" />{previousStep.title}</a>
			{/if}
			{#if nextStep}
				<a class="button primary next" href={nextStep.path}>{nextStep.title}<Icon name="arrowRight" /></a>
			{/if}
		</div>
	</main>

	<ConfirmDialog />
	<AddFolderDialog />
	<ImportDialog />

	{#if isPreviewShown}
		<aside class="preview" aria-label="Preview" bind:offsetWidth={previewOffsetWidth}>
			<PaneResizer
				class="preview-resizer"
				label="Resize preview"
				width={previewWidth.value ?? previewOffsetWidth}
				minWidth={PREVIEW_MIN_WIDTH}
				valueText={previewWidth.value === null ? 'Half the page' : `${previewWidth.value} pixels`}
				toWidth={event => window.innerWidth - event.clientX}
				onresize={resizePreview}
				onreset={() => (previewWidth.value = null)}
			/>
			<FileExplorer />
		</aside>
	{/if}
</div>
