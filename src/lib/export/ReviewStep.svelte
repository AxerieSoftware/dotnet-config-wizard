<script lang="ts">
	import { COMMENT_STYLES, type CommentStyle } from '../analyzers/severityBlocks.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import ValidationList from '../validation/ValidationList.svelte';
	import FileExplorer from './FileExplorer.svelte';
	import { NEXT_STEPS_FILE_NAME, toNextSteps } from './nextSteps.ts';

	const COMMENT_STYLE_LABELS: Record<CommentStyle, string> = { none: 'None', idAndTitle: 'Rule ID and title', titleAndLink: 'Rule ID, title and docs link' };

	const wizard = getWizardState();
	const nextSteps = $derived(toNextSteps(wizard.config, wizard.output.files));
</script>

<header class="step-header">
	<h1>Review and export</h1>
	<p>Fix any problems, then download or share from the top bar.</p>
</header>

<ValidationList issues={wizard.issues} />

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
