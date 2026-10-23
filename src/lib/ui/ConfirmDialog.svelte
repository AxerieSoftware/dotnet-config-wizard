<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';

	const wizard = getWizardState();
	let dialog: HTMLDialogElement | undefined = $state();
	let cancelButton: HTMLButtonElement | undefined = $state();

	$effect(() => {
		if (!wizard.pendingConfirmation || dialog?.open) return;

		dialog?.showModal();
		// Cancel takes focus, so Enter never discards work by accident.
		cancelButton?.focus();
	});

	function confirm(): void {
		const action = wizard.pendingConfirmation?.onConfirm;
		close();
		action?.();
	}

	function close(): void {
		wizard.pendingConfirmation = undefined;
		dialog?.close();
	}
</script>

<!--
	Closing by Escape, Cancel or confirming all clear the pending action. The close event comes later, so it only counts
	while the dialog is still closed, not after it has opened again for a new confirmation.
-->
<dialog
	class="confirm-dialog"
	bind:this={dialog}
	aria-labelledby="confirm-title"
	onclose={() => {
		if (!dialog?.open) wizard.pendingConfirmation = undefined;
	}}
>
	{#if wizard.pendingConfirmation}
		<h2 id="confirm-title">{wizard.pendingConfirmation.title}</h2>
		<p>{wizard.pendingConfirmation.message}</p>
		<div class="actions">
			<button type="button" class="danger" onclick={confirm}>{wizard.pendingConfirmation.confirmLabel}</button>
			<button type="button" bind:this={cancelButton} onclick={close}>Cancel</button>
		</div>
	{/if}
</dialog>
