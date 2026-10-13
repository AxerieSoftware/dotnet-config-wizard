<script lang="ts">
	type Props = {
		class: string;
		label: string;
		/** The pane's width in pixels. */
		width: number;
		minWidth: number;
		valueText: string;
		/** The width a pointer at this position asks for. */
		toWidth: (event: PointerEvent) => number;
		onresize: (width: number) => void;
		onreset: () => void;
	};

	const RESIZE_STEP = 32;
	const RESIZE_OFFSETS: Partial<Record<string, number>> = { ArrowLeft: RESIZE_STEP, ArrowRight: -RESIZE_STEP };

	let { class: className, label, width, minWidth, valueText, toWidth, onresize, onreset }: Props = $props();

	function drag(event: PointerEvent): void {
		const handle = event.currentTarget as HTMLElement;
		if (event.type === 'pointerdown') handle.setPointerCapture(event.pointerId);
		else if (handle.hasPointerCapture(event.pointerId)) onresize(toWidth(event));
	}

	// The resizable panes sit right of their divider, so the left arrow widens them.
	function resizeByKey(event: KeyboardEvent): void {
		const offset = RESIZE_OFFSETS[event.key];
		if (offset === undefined) return;

		event.preventDefault();
		onresize(width + offset);
	}
</script>

<!-- A focusable separator is the ARIA pattern for a resizable pane: drag it, use the arrow keys, or double-click to reset.
     Svelte doesn't count a focusable separator as interactive, so its checks are silenced here. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	class={`resizer ${className}`}
	role="separator"
	aria-orientation="vertical"
	aria-label={label}
	aria-valuenow={Math.round(width)}
	aria-valuetext={valueText}
	aria-valuemin={minWidth}
	tabindex="0"
	onpointerdown={drag}
	onpointermove={drag}
	onkeydown={resizeByKey}
	ondblclick={onreset}
></div>
