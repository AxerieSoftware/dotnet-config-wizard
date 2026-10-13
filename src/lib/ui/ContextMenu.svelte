<script lang="ts" module>
	import type { IconName } from './Icon.svelte';

	export type MenuItem = { label: string; icon?: IconName; isDanger?: boolean; onSelect: () => void };
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';

	const MENU_WIDTH = 240;
	const MENU_ITEM_HEIGHT = 36;

	type Props = { items: readonly MenuItem[]; x: number; y: number; label: string; onClose: () => void };

	/** A menu at a point, such as where a tree item was right-clicked. Arrow keys move, Enter picks, Escape closes. */
	let { items, x, y, label, onClose }: Props = $props();

	let menu: HTMLElement | undefined = $state();

	// Keep the menu on screen, and start keyboard users on the first item.
	const left = $derived(Math.min(x, window.innerWidth - MENU_WIDTH - 8));
	const top = $derived(Math.min(y, window.innerHeight - items.length * MENU_ITEM_HEIGHT - 16));

	$effect(() => {
		void tick().then(() => menu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
	});

	function select(item: MenuItem): void {
		onClose();
		item.onSelect();
	}

	function navigate(event: KeyboardEvent): void {
		const buttons = [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
		const index = buttons.indexOf(document.activeElement as HTMLElement);
		if (event.key === 'Escape' || event.key === 'Tab') {
			event.preventDefault();
			onClose();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const offset = event.key === 'ArrowDown' ? 1 : -1;
			buttons[(index + offset + buttons.length) % buttons.length]?.focus();
		}
	}

	function closeOutside(event: PointerEvent): void {
		if (!menu?.contains(event.target as Node)) onClose();
	}
</script>

<svelte:window onpointerdown={closeOutside} onblur={onClose} onresize={onClose} />

<div class="context-menu" role="menu" aria-label={label} tabindex="-1" bind:this={menu} style:left={`${left}px`} style:top={`${top}px`} onkeydown={navigate}>
	{#each items as item (item.label)}
		<button type="button" role="menuitem" class:danger-item={item.isDanger} onclick={() => select(item)}>
			{#if item.icon}
				<Icon name={item.icon} small />
			{:else}
				<span class="menu-icon-space"></span>
			{/if}
			{item.label}
		</button>
	{/each}
</div>
