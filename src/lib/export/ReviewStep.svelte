<script lang="ts">
	import { COMMENT_STYLES, type CommentStyle } from '../analyzers/severityBlocks.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { toZip } from './zipFiles.ts';

	const COMMENT_STYLE_LABELS: Record<CommentStyle, string> = { none: 'No comments', idAndTitle: 'Rule ID and title', titleAndLink: 'Rule ID, title and docs link' };
	const COPIED_MESSAGE_MS = 2000;
	const ZIP_FILE_NAME = 'dotnet-config.zip';

	const wizard = getWizardState();
	let isCopied = $state(false);

	async function copy(): Promise<void> {
		await navigator.clipboard.writeText(wizard.editorConfig.content);
		isCopied = true;
		setTimeout(() => (isCopied = false), COPIED_MESSAGE_MS);
	}

	function download(): void {
		// A zip keeps dotfile names intact; browsers rename a downloaded ".editorconfig".
		const url = URL.createObjectURL(new Blob([toZip([wizard.editorConfig])], { type: 'application/zip' }));
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

{#if wizard.editorConfig.skippedKeys.length > 0}
	<p class="warning" role="alert">Left out because SDK {wizard.catalog.band} doesn't know them: {wizard.editorConfig.skippedKeys.join(', ')}.</p>
{/if}

<div class="actions">
	<button type="button" onclick={copy}>{isCopied ? 'Copied' : 'Copy'}</button>
	<button type="button" onclick={download}>Download zip</button>
</div>

<pre class="file" data-testid="review-file"><code>{wizard.editorConfig.content}</code></pre>
