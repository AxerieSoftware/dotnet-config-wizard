<script lang="ts">
	import { getWizardState } from '../config/wizardState.svelte.ts';

	const wizard = getWizardState();
</script>

{#if wizard.config.scopes.length > 1}
	<label class="scope-switcher">
		<span>Editing</span>
		<select aria-label="Folder being edited" bind:value={wizard.activeScopePath}>
			{#each wizard.config.scopes as scope (scope.path)}
				<option value={scope.path}>{scope.path === '' ? 'Root (whole repo)' : `${scope.path}/`}</option>
			{/each}
		</select>
		{#if !wizard.isRootActive}
			<span class="note">Unset settings inherit from the folder above; set one to override it here.</span>
		{/if}
	</label>
{/if}
