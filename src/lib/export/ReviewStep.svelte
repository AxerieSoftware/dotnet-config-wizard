<script lang="ts">
	import { COMMENT_STYLES, type CommentStyle } from '../analyzers/severityBlocks.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import GeneratedFiles from './GeneratedFiles.svelte';
	import { toZip } from './zipFiles.ts';

	const COMMENT_STYLE_LABELS: Record<CommentStyle, string> = { none: 'No comments', idAndTitle: 'Rule ID and title', titleAndLink: 'Rule ID, title and docs link' };
	const COPIED_MESSAGE_MS = 2000;
	const ZIP_FILE_NAME = 'dotnet-config.zip';

	const wizard = getWizardState();
	let isCopied = $state(false);

	async function copy(): Promise<void> {
		await navigator.clipboard.writeText(wizard.output.files[0].content);
		isCopied = true;
		setTimeout(() => (isCopied = false), COPIED_MESSAGE_MS);
	}

	function download(): void {
		// A zip keeps dotfile names intact; browsers rename a downloaded ".editorconfig".
		const url = URL.createObjectURL(new Blob([toZip(wizard.output.files)], { type: 'application/zip' }));
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

{#if wizard.output.skippedKeys.length > 0}
	<div class="warning" role="alert">
		<p>These settings were left out of the files:</p>
		<ul>
			{#each wizard.output.skippedKeys as skipped (`${skipped.scopePath}:${skipped.key}`)}
				<li><code>{skipped.key}</code> in {skipped.scopePath || 'the root'}: {skipped.reason}</li>
			{/each}
		</ul>
	</div>
{/if}

<div class="actions">
	<button type="button" onclick={copy}>{isCopied ? 'Copied' : 'Copy root .editorconfig'}</button>
	<button type="button" onclick={download}>Download zip</button>
</div>

<GeneratedFiles files={wizard.output.files} />
