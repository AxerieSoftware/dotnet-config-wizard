<script lang="ts">
	import { getParentScope } from '../config/scopes.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import Icon from './Icon.svelte';

	const wizard = getWizardState();
	const parent = $derived(getParentScope(wizard.config, wizard.activeScope));
	const parentLabel = $derived(parent?.path ? `${parent.path}/` : 'the repo root');
</script>

<!-- Says which folder the step edits, since every per-folder step changes only that folder's files. -->
<div class="editing-folder" role="status">
	<Icon name="folder" />
	{#if wizard.isRootActive}
		<span>Editing the <strong>repo root</strong>. Subfolders can override it.</span>
	{:else}
		<span>Editing <strong>{wizard.activeScopePath}/</strong>. Unset values come from {parentLabel}.</span>
		<button type="button" class="small" onclick={() => (wizard.activeScopePath = '')}>Edit the repo root</button>
	{/if}
</div>
