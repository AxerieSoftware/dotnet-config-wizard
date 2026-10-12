<script lang="ts">
	import { COMMENT_STYLES, type CommentStyle } from '../analyzers/severityBlocks.ts';
	import { toShareUrl } from '../config/initialState.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import ValidationList from '../validation/ValidationList.svelte';
	import GeneratedFiles from './GeneratedFiles.svelte';
	import { toNextSteps, toNextStepsMarkdown } from './nextSteps.ts';
	import { toZip } from './zipFiles.ts';

	const COMMENT_STYLE_LABELS: Record<CommentStyle, string> = { none: 'No comments', idAndTitle: 'Rule ID and title', titleAndLink: 'Rule ID, title and docs link' };
	const COPIED_MESSAGE_MS = 2000;
	const ZIP_FILE_NAME = 'dotnet-config.zip';
	const NEXT_STEPS_FILE_NAME = 'DOTNET-CONFIG.md';

	const wizard = getWizardState();
	let isCopied = $state(false);
	const nextSteps = $derived(toNextSteps(wizard.config, wizard.output.files));
	let shareUrl = $state<string | undefined>(undefined);

	async function copy(): Promise<void> {
		await navigator.clipboard.writeText(wizard.output.files[0].content);
		isCopied = true;
		setTimeout(() => (isCopied = false), COPIED_MESSAGE_MS);
	}

	async function share(): Promise<void> {
		shareUrl = toShareUrl(location, wizard.savedState);
		await navigator.clipboard.writeText(shareUrl);
	}

	function download(): void {
		// A zip keeps dotfile names intact; browsers rename a downloaded ".editorconfig".
		const url = URL.createObjectURL(new Blob([toZip([...wizard.output.files, { path: NEXT_STEPS_FILE_NAME, content: toNextStepsMarkdown(nextSteps) }])], { type: 'application/zip' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = ZIP_FILE_NAME;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<h1>Review and export</h1>

<label class="field inline">
	<span>Rule comments</span>
	<select bind:value={wizard.commentStyle}>
		{#each COMMENT_STYLES as commentStyle (commentStyle)}
			<option value={commentStyle}>{COMMENT_STYLE_LABELS[commentStyle]}</option>
		{/each}
	</select>
</label>

<ValidationList issues={wizard.issues} />

<section class="card" aria-labelledby="next-steps-heading">
	<h2 id="next-steps-heading">Next steps</h2>
	<ol>
		{#each nextSteps as step (step)}
			<li>{step.replaceAll('`', '')}</li>
		{/each}
	</ol>
	<p class="note">The zip includes these as {NEXT_STEPS_FILE_NAME}.</p>
</section>

<div class="actions">
	<button type="button" onclick={copy}>{isCopied ? 'Copied' : 'Copy root .editorconfig'}</button>
	<button type="button" onclick={download}>Download zip</button>
	<button type="button" class="secondary" onclick={share}>Copy share link</button>
</div>
{#if shareUrl}
	<label class="field">
		<span>Share link, copied to the clipboard. It holds only what differs from the {wizard.presetId} preset.</span>
		<input aria-label="Share link" readonly value={shareUrl}>
	</label>
{/if}

<GeneratedFiles files={wizard.output.files} />
