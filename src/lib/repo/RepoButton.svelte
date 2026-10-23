<script lang="ts">
	import { onMount } from 'svelte';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import ContextMenu from '../ui/ContextMenu.svelte';
	import Icon from '../ui/Icon.svelte';
	import { askToOpenRepo, askToReopenFolder, openFolderFromList, toReadOnlyReason } from './openRepo.ts';
	import { loadRememberedFolder } from './rememberedFolder.ts';

	const STATUS_TEXT = { saved: 'Saved', saving: 'Saving…', failed: "Couldn't save", 'read-only': 'Read-only' } as const;

	const wizard = getWizardState();
	let folderInput: HTMLInputElement | undefined = $state();
	let menu = $state<{ x: number; y: number } | undefined>(undefined);
	// Only offered while no folder is open; the open one is the remembered one.
	const rememberedFolder = $derived(wizard.repo ? undefined : wizard.rememberedFolder);

	onMount(() => {
		void loadRememberedFolder().then(folder => (wizard.rememberedFolder ??= folder));
	});

	// One button says where the settings live, in this browser or a repo folder, and opens, reconnects or closes it.
	const title = $derived.by(() => {
		if (wizard.repo?.status === 'read-only') return toReadOnlyReason();
		if (wizard.repo) return wizard.repo.failure ?? `Edits save to ${wizard.repo.name}.`;
		if (rememberedFolder) return `Reopen ${rememberedFolder.name} to load its files and keep saving to it, or open another folder.`;
		const saved = wizard.isSavedInBrowser ? 'Settings are saved in this browser.' : 'Nothing saved yet; changes save in this browser.';
		return `${saved} Open a repo folder to load its config files and save straight to them.`;
	});

	function click(event: MouseEvent): void {
		if (wizard.repo || rememberedFolder) {
			const buttonBounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
			menu = { x: buttonBounds.left, y: buttonBounds.bottom + 4 };
		} else {
			askToOpenRepo(wizard, folderInput);
		}
	}
</script>

<button type="button" class={`repo-button ${wizard.repo?.status ?? 'browser'}`} {title} onclick={click}>
	{#if wizard.repo}
		<Icon name="folderOpen" />
		<span class="repo-name">{wizard.repo.name}</span>
		<span class="label" role="status">{STATUS_TEXT[wizard.repo.status]}</span>
	{:else if rememberedFolder}
		<Icon name="folder" />
		<span class="repo-name">{rememberedFolder.name}</span>
		<span class="label">Reopen</span>
	{:else}
		<Icon name="globe" />
		<span class="repo-name">In browser</span>
		<span class="label">{wizard.isSavedInBrowser ? 'Saved' : 'Open folder'}</span>
	{/if}
</button>
<input class="visually-hidden" type="file" webkitdirectory tabindex="-1" aria-hidden="true" bind:this={folderInput} onchange={event => void openFolderFromList(wizard, event.currentTarget.files)}>

{#if menu && wizard.repo}
	<ContextMenu
		label={wizard.repo.name}
		x={menu.x}
		y={menu.y}
		items={[
			{ label: 'Open another folder', icon: 'folderOpen', onSelect: () => askToOpenRepo(wizard, folderInput) },
			{ label: 'Close folder', icon: 'dismiss', onSelect: () => wizard.closeRepo() }
		]}
		onClose={() => (menu = undefined)}
	/>
{:else if menu && rememberedFolder}
	{@const folder = rememberedFolder}
	<ContextMenu
		label={folder.name}
		x={menu.x}
		y={menu.y}
		items={[
			{ label: `Reopen ${folder.name}`, icon: 'folderOpen', onSelect: () => askToReopenFolder(wizard, folder) },
			{ label: 'Open another folder', icon: 'folder', onSelect: () => askToOpenRepo(wizard, folderInput) },
			{
				label: 'Forget folder',
				icon: 'dismiss',
				onSelect: () => wizard.forgetRememberedFolder()
			}
		]}
		onClose={() => (menu = undefined)}
	/>
{/if}
