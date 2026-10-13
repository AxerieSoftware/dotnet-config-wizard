<script lang="ts">
	import { toShareUrl } from '../config/initialState.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import Icon from '../ui/Icon.svelte';
	import { NEXT_STEPS_FILE_NAME, toNextSteps, toNextStepsMarkdown } from './nextSteps.ts';
	import { toZip } from './zipFiles.ts';

	const ZIP_FILE_NAME = 'dotnet-config.zip';
	const COPY_RESULT_MS = 2000;
	const SHARE_LABELS = { copied: 'Copied to clipboard', failed: "Couldn't copy" } as const;
	const SHARE_ICONS = { copied: 'checkmark', failed: 'errorCircle' } as const;

	const wizard = getWizardState();
	let copyResult = $state<'copied' | 'failed' | undefined>(undefined);
	let resultTimer: ReturnType<typeof setTimeout> | undefined;

	async function share(): Promise<void> {
		try {
			await navigator.clipboard.writeText(toShareUrl(location, wizard.savedState));
			showResult('copied');
		} catch {
			// The browser can refuse clipboard access, such as when the page isn't focused.
			showResult('failed');
		}
	}

	function showResult(result: 'copied' | 'failed'): void {
		copyResult = result;
		clearTimeout(resultTimer);
		resultTimer = setTimeout(() => (copyResult = undefined), COPY_RESULT_MS);
	}

	function download(): void {
		// A zip keeps dotfile names intact; browsers rename a downloaded ".editorconfig".
		const nextStepsFile = { path: NEXT_STEPS_FILE_NAME, content: toNextStepsMarkdown(toNextSteps(wizard.config, wizard.output.files)) };
		const url = URL.createObjectURL(new Blob([toZip([...wizard.output.files, nextStepsFile])], { type: 'application/zip' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = ZIP_FILE_NAME;
		link.click();
		// Some browsers start the download after click returns, so the URL has to outlive it.
		setTimeout(() => URL.revokeObjectURL(url));
	}
</script>

<button type="button" class="subtle" onclick={share}>
	<Icon name={copyResult ? SHARE_ICONS[copyResult] : 'link'} /><span class="label" aria-live="polite">{copyResult ? SHARE_LABELS[copyResult] : 'Copy share link'}</span>
</button>
<button type="button" class="primary" onclick={download}><Icon name="arrowDownload" /><span class="label">Download zip</span></button>
