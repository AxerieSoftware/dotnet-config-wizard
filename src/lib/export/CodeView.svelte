<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import OptionHelp from '../codeStyle/OptionHelp.svelte';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import type { EffectiveFile } from './effectiveFiles.ts';
	import type { GeneratedFile } from './generatedFile.ts';
	import { type CodeToken, loadHighlighter, toCodeLanguage, toCodeTokens } from './highlighter.ts';
	import { describeLine, type LineInfo, type LineTarget, toLineSections } from './lineInfo.ts';

	const HOVER_DELAY_MS = 250;
	const FLASH_MS = 1600;
	const COMMENT_LINE = /^\s*(#|<!--)/;
	const LINE_STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

	type Props = {
		file: GeneratedFile | EffectiveFile;
		/** The folder whose settings a click edits: the file's own folder, or the folder an effective view is for. */
		folderPath: string;
		testId: string;
		isVisible: boolean;
		/** The line the setting being edited writes, highlighted and scrolled to. */
		linkedIndex?: number;
	};

	let { file, folderPath, testId, isVisible, linkedIndex }: Props = $props();

	const wizard = getWizardState();
	const language = $derived(toCodeLanguage(file.path));
	const lines = $derived(file.content.split('\n'));
	const ownLines = $derived('ownLines' in file ? file.ownLines : undefined);
	// The .editorconfig section each line is in, so formatting keys know which file type they configure.
	const sections = $derived(toLineSections(lines));

	// Tokens are kept with the content they were made from, so a file that just changed never shows stale text.
	let highlighted = $state<{ content: string; tokens: (CodeToken[] | undefined)[] } | undefined>(undefined);
	const tokens = $derived(highlighted?.content === file.content ? highlighted.tokens : undefined);
	let hovered = $state<{ index: number; info: LineInfo; top: number; left: number } | undefined>(undefined);
	let hoverTimer: ReturnType<typeof setTimeout> | undefined;
	let panel: HTMLElement | undefined = $state();

	// Only the file on screen is highlighted; the rest stay plain text until shown.
	$effect(() => {
		const content = file.content;
		const codeLanguage = language;
		if (!isVisible || !codeLanguage) {
			highlighted = undefined;
			return;
		}

		let isCurrent = true;
		loadHighlighter()
			.then(highlighter => {
				if (isCurrent) highlighted = { content, tokens: toCodeTokens(highlighter, content, codeLanguage) };
			})
			.catch(() => {
				// Without the highlighter the file still reads as plain text.
			});
		return () => {
			isCurrent = false;
		};
	});

	// Centers the linked line in the file's own scroll area, without scrolling the page the setting is on.
	$effect(() => {
		const index = linkedIndex;
		if (index === undefined || !isVisible) return;

		void tick().then(() => {
			const line = panel?.querySelector<HTMLElement>(`[data-line="${index}"]`);
			if (panel && line) panel.scrollTop = line.offsetTop - panel.clientHeight / 2;
		});
	});

	function hover(event: MouseEvent): void {
		const line = (event.target as HTMLElement).closest<HTMLElement>('.line');
		if (!line) return;

		const index = Number(line.dataset.line);
		if (hovered?.index === index) return;

		clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => show(index), HOVER_DELAY_MS);
	}

	function describe(index: number): LineInfo | undefined {
		return describeLine(file.path, lines[index], sections[index], wizard.catalog);
	}

	function show(index: number): void {
		const info = describe(index);
		const line = panel?.querySelector<HTMLElement>(`[data-line="${index}"]`);
		hovered = info && line && panel ? { index, info, top: line.offsetTop + line.offsetHeight, left: panel.scrollLeft + 48 } : undefined;
	}

	function leave(): void {
		clearTimeout(hoverTimer);
		hovered = undefined;
	}

	function edit(event: MouseEvent): void {
		const line = (event.target as HTMLElement).closest<HTMLElement>('.line');
		if (line) openLine(Number(line.dataset.line));
	}

	/** Up and Down move through the lines that have an explanation, Enter opens the setting, and Escape closes the card. */
	function navigate(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			hovered = undefined;
			return;
		}

		if (event.key === 'Enter' && hovered) {
			event.preventDefault();
			openLine(hovered.index);
			return;
		}

		const step = LINE_STEPS[event.key];
		if (step === undefined) return;

		event.preventDefault();
		const startIndex = hovered?.index ?? (step > 0 ? -1 : lines.length);
		for (let index = startIndex + step; index >= 0 && index < lines.length; index += step) {
			if (!describe(index)) continue;

			show(index);
			panel?.querySelector(`[data-line="${index}"]`)?.scrollIntoView({ block: 'nearest' });
			return;
		}
	}

	function openLine(index: number): void {
		const target = describe(index)?.target;
		if (target) void openTarget(target);
	}

	/** Opens the step that sets a line, in the folder it belongs to, and focuses the control once it renders. */
	async function openTarget(target: LineTarget): Promise<void> {
		wizard.activeScopePath = folderPath;
		if (target.ruleSearch) wizard.showRule(target.ruleSearch);
		// goto resolves after SvelteKit resets focus for the new page, so the setting takes focus after it.
		if (page.url.pathname !== target.path) await goto(target.path);
		await tick();
		if (target.selector) focusSetting(target.selector);
	}

	function focusSetting(selector: string): void {
		const element = document.querySelector<HTMLElement>(selector);
		if (!element) return;

		element.scrollIntoView({ block: 'center' });
		element.focus({ preventScroll: true });
		element.classList.add('flash');
		setTimeout(() => element.classList.remove('flash'), FLASH_MS);
	}
</script>

<!--
	Scrollable file contents are a focusable, labeled region (WCAG). Hovering a line, or moving to it with the arrow keys,
	explains it; clicking it or pressing Enter jumps to its setting. Svelte doesn't count a keyboard-operable region as
	interactive, so its checks are silenced here.
-->
<!-- A hidden file stays one plain text node, so only the file on screen pays for a span per line. -->
{#if !isVisible}
	<pre class="file" data-testid={testId} hidden>{file.content}</pre>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="file-panel"
		role="region"
		tabindex="0"
		aria-label={`Contents of ${file.path}. Use the up and down arrows to explain each line, and Enter to change it.`}
		aria-describedby={hovered ? `${testId}-line-info` : undefined}
		bind:this={panel}
		onmousemove={hover}
		onmouseleave={leave}
		onclick={edit}
		onkeydown={navigate}
	>
		<pre class="file" data-testid={testId}><code
			>{#each lines as text, index (index)}{#if index > 0}{'\n'}{/if}<span
					class="line"
					class:own={ownLines?.has(text.trim())}
					class:active={hovered?.index === index}
					class:linked={linkedIndex === index}
					class:clickable={hovered?.index === index && hovered.info.target}
					data-line={index}
					>{#if tokens?.[index]}{#each tokens[index] as token, tokenIndex (tokenIndex)}<span style={token.style}>{token.content}</span>{/each}{:else if COMMENT_LINE.test(text)}<span
							class="comment">{text}</span
						>{:else}{text}{/if}</span
				>{/each}</code
		></pre>
		{#if hovered}
			<div class="line-info" id={`${testId}-line-info`} role="tooltip" style:top={`${hovered.top}px`} style:left={`${hovered.left}px`}>
				<strong>{hovered.info.title}</strong>
				{#each hovered.info.details as detail (detail)}
					<span>{detail}</span>
				{/each}
				{#if hovered.info.option}
					<OptionHelp option={hovered.info.option.option} value={hovered.info.option.value} />
				{/if}
				<span class="line-info-actions">
					{#if hovered.info.target}
						<span class="caption">Click or press Enter to change it.</span>
					{/if}
					{#if hovered.info.href}
						<a href={hovered.info.href}>Details</a>
					{/if}
				</span>
			</div>
		{/if}
	</div>
{/if}
