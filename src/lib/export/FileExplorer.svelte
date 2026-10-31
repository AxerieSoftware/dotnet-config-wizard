<script lang="ts">
	import { untrack } from 'svelte';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import ContextMenu, { type MenuItem } from '../ui/ContextMenu.svelte';
	import Icon from '../ui/Icon.svelte';
	import PaneResizer from '../ui/PaneResizer.svelte';
	import { SessionValue } from '../ui/sessionValue.svelte.ts';
	import CodeView from './CodeView.svelte';
	import { hasEffectiveVersion } from './effectiveFiles.ts';
	import { type FolderNode, type TreeNode, toFileName, toFileTree, toFolderName, toFolderPath } from './fileTree.ts';

	const COPIED_MESSAGE_MS = 2000;
	const TREE_DEFAULT_WIDTH = 200;
	const TREE_MIN_WIDTH = 140;
	const VIEWER_MIN_WIDTH = 240;
	const TREE_ROW_PADDING = 8;
	const TREE_INDENT = 16;
	// The guide line under an open folder runs through the middle of its chevron.
	const GUIDE_OFFSET = 5;

	const wizard = getWizardState();
	let selectedPath = $state('');
	let viewMode = $state<'file' | 'effective'>('file');
	// Folders toggled away from their default: ignored folders start collapsed, every other folder starts open.
	let toggledPaths = $state<string[]>([]);
	let focusedPath = $state('');
	let isCopied = $state(false);
	let menu = $state<{ x: number; y: number; node: TreeNode } | undefined>(undefined);
	// The tree's width is remembered apart from the preview's; double-clicking its divider restores the default.
	const treeWidth = new SessionValue('tree-width', TREE_DEFAULT_WIDTH, { isLasting: true });
	let explorer: HTMLElement | undefined = $state();

	const files = $derived(wizard.output.files);
	const tree = $derived(toFileTree(wizard.config.scopes, files));
	const folderPath = $derived(wizard.activeScopePath);
	const folderFiles = $derived(files.filter(file => toFolderPath(file.path) === folderPath));
	// Switching folders opens that folder's first file, or keeps the open file when the folder writes none of its own.
	const selectedFile = $derived(folderFiles.find(file => file.path === selectedPath) ?? folderFiles[0] ?? files.find(file => file.path === selectedPath) ?? files[0]);
	// The effective view merges the open file with the same file in every folder above, so it exists only for files that
	// inherit. It's generated only while shown, since it renders the whole config a second time.
	const effectiveName = $derived(selectedFile && toFolderPath(selectedFile.path) === folderPath ? toFileName(selectedFile.path) : '.editorconfig');
	const canShowEffective = $derived(!wizard.isRootActive && hasEffectiveVersion(effectiveName));
	const shownEffective = $derived(viewMode === 'effective' && canShowEffective ? wizard.effectiveFiles?.find(file => file.path === effectiveName) : undefined);
	const isEffectiveShown = $derived(viewMode === 'effective' && shownEffective !== undefined);
	const shownContent = $derived(isEffectiveShown ? shownEffective?.content : selectedFile?.content);
	const visibleNodes = $derived(toVisibleNodes(tree));

	// Editing a setting opens the file it's written to.
	$effect(() => {
		const linked = wizard.linkedLine;
		if (!linked) return;

		untrack(() => {
			selectedPath = linked.path;
			viewMode = 'file';
		});
	});

	function toVisibleNodes(folder: FolderNode): TreeNode[] {
		const children = isCollapsedFolder(folder.path) ? [] : folder.children.flatMap(node => (node.kind === 'folder' ? toVisibleNodes(node) : [node]));
		return [folder, ...children];
	}

	function toRowIndent(depth: number): number {
		return TREE_ROW_PADDING + depth * TREE_INDENT;
	}

	function toNodeId(node: TreeNode): string {
		return `tree-${node.kind}-${node.path || 'root'}`;
	}

	/** Opening a file or folder makes its folder the one being edited. */
	function open(node: TreeNode): void {
		focusedPath = node.path;
		if (node.kind === 'file') {
			wizard.activeScopePath = toFolderPath(node.path);
			selectedPath = node.path;
			viewMode = 'file';
			return;
		}

		if (node.isScope) wizard.activeScopePath = node.path;
	}

	function toggle(folder: FolderNode): void {
		toggledPaths = toggledPaths.includes(folder.path) ? toggledPaths.filter(path => path !== folder.path) : [...toggledPaths, folder.path];
	}

	// Tree items nest, so each handler only acts for the item the event started in.
	function isOwnEvent(event: Event): boolean {
		return (event.target as HTMLElement).closest('[role="treeitem"]') === event.currentTarget;
	}

	function clickItem(event: MouseEvent, node: TreeNode): void {
		if (!isOwnEvent(event)) return;

		if (node.kind === 'folder' && (event.target as HTMLElement).hasAttribute('data-toggle')) toggle(node);
		else open(node);
	}

	function focusItem(event: FocusEvent, node: TreeNode): void {
		if (isOwnEvent(event)) focusedPath = node.path;
	}

	/** Arrow keys move through the visible items, Left and Right fold folders, and Enter or Space opens the item. */
	function navigate(event: KeyboardEvent, node: TreeNode): void {
		if (!isOwnEvent(event)) return;

		const index = visibleNodes.indexOf(node);
		let next: TreeNode | undefined;
		if (event.key === 'ArrowDown') next = visibleNodes[Math.min(index + 1, visibleNodes.length - 1)];
		else if (event.key === 'ArrowUp') next = visibleNodes[Math.max(index - 1, 0)];
		else if (event.key === 'Home') next = visibleNodes[0];
		else if (event.key === 'End') next = visibleNodes.at(-1);
		else if (event.key === 'ArrowRight' && node.kind === 'folder' && isCollapsedFolder(node.path)) toggle(node);
		else if (event.key === 'ArrowLeft' && node.kind === 'folder' && !isCollapsedFolder(node.path)) toggle(node);
		else if (event.key === 'Enter' || event.key === ' ') open(node);
		else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
			const row = (event.currentTarget as HTMLElement).querySelector('.tree-row')?.getBoundingClientRect();
			menu = { x: (row?.left ?? 0) + 24, y: row?.bottom ?? 0, node };
		} else return;

		event.preventDefault();
		if (!next) return;

		focusedPath = next.path;
		document.getElementById(toNodeId(next))?.focus();
	}

	function openMenu(event: MouseEvent, node: TreeNode): void {
		if (!isOwnEvent(event)) return;

		event.preventDefault();
		focusedPath = node.path;
		menu = { x: event.clientX, y: event.clientY, node };
	}

	/** What a tree item's menu offers: folders add, import, show and remove; files copy. */
	function toMenuItems(node: TreeNode): MenuItem[] {
		if (node.kind === 'file') {
			const file = files.find(entry => entry.path === node.path);
			return [
				{ label: 'Open', icon: 'document', onSelect: () => open(node) },
				{ label: 'Copy contents', icon: 'copy', onSelect: () => void navigator.clipboard.writeText(file?.content ?? '') }
			];
		}

		if (!node.isScope) {
			return [
				{ label: 'Give this folder its own settings', icon: 'folder', onSelect: () => wizard.addScope({ path: node.path }) },
				{
					label: 'Ignore code in this folder',
					icon: 'eyeOff',
					onSelect: () => {
						wizard.addScope({ path: node.path });
						wizard.setIgnored(node.path, true);
					}
				},
				{ label: 'Add a folder inside', icon: 'folderAdd', onSelect: () => wizard.askToAddFolder(node.path) }
			];
		}

		const isRoot = node.path === '';
		return [
			{ label: isRoot ? "Edit the repo root's settings" : "Edit this folder's settings", icon: 'folder', onSelect: () => open(node) },
			{ label: isRoot ? 'Add a folder' : 'Add a folder inside', icon: 'folderAdd', onSelect: () => wizard.askToAddFolder(node.path) },
			{ label: 'Import files into this folder', icon: 'arrowDownload', onSelect: () => (wizard.importTargetPath = node.path) },
			...(isRoot
				? []
				: [
						{
							label: 'Show effective settings',
							icon: 'info' as const,
							onSelect: () => {
								open(node);
								viewMode = 'effective';
							}
						},
						isIgnoredFolder(node.path)
							? { label: 'Stop ignoring code in this folder', icon: 'eye' as const, onSelect: () => wizard.setIgnored(node.path, false) }
							: { label: 'Ignore code in this folder', icon: 'eyeOff' as const, onSelect: () => wizard.setIgnored(node.path, true) },
						{ label: 'Remove folder', icon: 'dismiss' as const, isDanger: true, onSelect: () => wizard.askToRemoveScope(node.path) }
					])
		];
	}

	function isCollapsedFolder(path: string): boolean {
		return toggledPaths.includes(path) !== isIgnoredFolder(path);
	}

	function isIgnoredFolder(path: string): boolean {
		return wizard.config.scopes.some(scope => scope.path === path && scope.isIgnored);
	}

	function resizeTree(width: number): void {
		const maxWidth = Math.max(TREE_MIN_WIDTH, (explorer?.clientWidth ?? 0) - VIEWER_MIN_WIDTH);
		treeWidth.value = Math.round(Math.max(TREE_MIN_WIDTH, Math.min(width, maxWidth)));
	}

	async function copy(): Promise<void> {
		if (shownContent === undefined) return;

		await navigator.clipboard.writeText(shownContent);
		isCopied = true;
		setTimeout(() => (isCopied = false), COPIED_MESSAGE_MS);
	}
</script>

{#snippet treeNode(node: TreeNode, depth: number)}
	{#if node.kind === 'folder'}
		{@const isCollapsed = isCollapsedFolder(node.path)}
		{@const isEditing = node.isScope && node.path === folderPath}
		<li
			role="treeitem"
			id={toNodeId(node)}
			tabindex={focusedPath === node.path ? 0 : -1}
			aria-expanded={node.children.length > 0 ? !isCollapsed : undefined}
			aria-selected={isEditing && !selectedFile}
			aria-label={`${toFolderName(node.path)}${isEditing ? ', editing' : ''}`}
			onclick={event => clickItem(event, node)}
			onkeydown={event => navigate(event, node)}
			oncontextmenu={event => openMenu(event, node)}
			onfocus={event => focusItem(event, node)}
		>
			<div class="tree-row" class:editing={isEditing} class:muted={!node.isScope} style:padding-left={`${toRowIndent(depth)}px`}>
				<!-- An empty folder has nothing to expand, so no chevron suggests the rows below belong to it. -->
				{#if node.children.length > 0}
					<span class="chevron" class:collapsed={isCollapsed} data-toggle></span>
				{:else}
					<span class="chevron-space"></span>
				{/if}
				<Icon name="folder" small />
				<span>{node.path === '' ? 'Repo root' : `${node.name}/`}</span>
				{#if isIgnoredFolder(node.path)}
					<span class="tree-empty">ignored</span>
				{:else if node.children.length === 0}
					<span class="tree-empty">no files</span>
				{/if}
			</div>
			{#if !isCollapsed && node.children.length > 0}
				<ul role="group" style:--guide-left={`${toRowIndent(depth) + GUIDE_OFFSET}px`}>
					{#each node.children as child (child.path)}
						{@render treeNode(child, depth + 1)}
					{/each}
				</ul>
			{/if}
		</li>
	{:else}
		{@const isOpen = !isEffectiveShown && node.path === selectedFile?.path}
		<li
			role="treeitem"
			id={toNodeId(node)}
			tabindex={focusedPath === node.path ? 0 : -1}
			aria-selected={isOpen}
			aria-label={node.path}
			onclick={event => clickItem(event, node)}
			onkeydown={event => navigate(event, node)}
			oncontextmenu={event => openMenu(event, node)}
			onfocus={event => focusItem(event, node)}
		>
			<!-- A file's icon lines up with a folder's at the same depth; the spacer stands in for the folder's chevron. -->
			<div class="tree-row" class:open={isOpen} style:padding-left={`${toRowIndent(depth)}px`}>
				<span class="chevron-space"></span>
				<Icon name="document" small />
				<span class="mono">{node.name}</span>
			</div>
		</li>
	{/if}
{/snippet}

<div class="explorer" bind:this={explorer} style:--tree-width={`${treeWidth.value}px`}>
	<PaneResizer
		class="tree-resizer"
		label="Resize file tree"
		width={treeWidth.value}
		minWidth={TREE_MIN_WIDTH}
		valueText={`${treeWidth.value} pixels`}
		toWidth={event => (explorer?.getBoundingClientRect().right ?? 0) - event.clientX}
		onresize={resizeTree}
		onreset={() => (treeWidth.value = TREE_DEFAULT_WIDTH)}
	/>
	<div class="tree-pane">
		<ul class="file-tree" role="tree" aria-label="Generated files">
			{@render treeNode(tree, 0)}
		</ul>
		<p class="tree-hint caption">Right-click a folder to add, import or remove.</p>
	</div>

	<div class="viewer">
		<div class="viewer-bar">
			<span class="viewer-path mono">{isEffectiveShown ? `${folderPath}/${effectiveName}` : (selectedFile?.path ?? 'No files')}</span>
			{#if canShowEffective}
				<div class="segmented" role="group" aria-label="View">
					<button type="button" aria-pressed={!isEffectiveShown} disabled={!selectedFile} onclick={() => (viewMode = 'file')}>File</button>
					<button type="button" aria-pressed={isEffectiveShown} onclick={() => (viewMode = 'effective')}>Effective</button>
				</div>
			{/if}
			<button type="button" class="subtle small" disabled={shownContent === undefined} onclick={copy}>{isCopied ? 'Copied' : 'Copy'}</button>
		</div>
		{#if isEffectiveShown}
			<p class="viewer-note caption">Merged with every {effectiveName} above. <span class="own-sample">Highlighted</span> lines are set in {folderPath}/.</p>
		{/if}
		{#each files as file (file.path)}
			<CodeView
				{file}
				folderPath={toFolderPath(file.path)}
				testId={`file-${file.path}`}
				isVisible={!isEffectiveShown && file === selectedFile}
				linkedIndex={wizard.linkedLine?.path === file.path ? wizard.linkedLine.index : undefined}
			/>
		{/each}
		{#if isEffectiveShown && shownEffective}
			<CodeView file={shownEffective} {folderPath} testId={`effective-${shownEffective.path}`} isVisible />
		{/if}
	</div>
</div>

{#if menu}
	<ContextMenu items={toMenuItems(menu.node)} x={menu.x} y={menu.y} label={menu.node.kind === 'file' ? menu.node.path : toFolderName(menu.node.path)} onClose={() => (menu = undefined)} />
{/if}
