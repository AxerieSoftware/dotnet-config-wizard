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
		dialog?.close();
		action?.();
	}
</script>

<!-- Closing by Escape, Cancel or confirming all clear the pending action. -->
<dialog class="confirm-dialog" bind:this={dialog} aria-labelledby="confirm-title" onclose={() => (wizard.pendingConfirmation = undefined)}>
	{#if wizard.pendingConfirmation}
		<h2 id="confirm-title">{wizard.pendingConfirmation.title}</h2>
		<p>{wizard.pendingConfirmation.message}</p>
		<div class="actions">
			<button type="button" class="danger" onclick={confirm}>{wizard.pendingConfirmation.confirmLabel}</button>
			<button type="button" bind:this={cancelButton} onclick={() => dialog?.close()}>Cancel</button>
		</div>
	{/if}
</dialog>
