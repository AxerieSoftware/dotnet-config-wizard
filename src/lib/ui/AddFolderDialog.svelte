<script lang="ts">
	import { SCOPE_PRESETS, toScopePath, toScopePreset } from '../config/scopePresets.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import Icon from './Icon.svelte';

	const wizard = getWizardState();
	let dialog: HTMLDialogElement | undefined = $state();
	let path = $state('');
	let problem = $state<string | undefined>(undefined);

	const existingPaths = $derived(wizard.config.scopes.map(scope => scope.path));
	const unusedPresets = $derived(SCOPE_PRESETS.filter(preset => !existingPaths.includes(preset.scope.path)));

	// A folder added from a folder's menu goes inside it, and only the common folders sit at the repo root.
	const parentPath = $derived(wizard.addFolderParentPath ?? '');

	$effect(() => {
		if (wizard.addFolderParentPath === undefined || dialog?.open) return;

		path = parentPath === '' ? '' : `${parentPath}/`;
		dialog?.showModal();
	});

	function addPreset(presetPath: string): void {
		wizard.addScope(toScopePreset(presetPath, wizard.config));
		dialog?.close();
	}

	function addTyped(event: SubmitEvent): void {
		event.preventDefault();
		const result = toScopePath(path, existingPaths);
		if (result.status === 'invalid') {
			problem = result.reason;
			return;
		}

		wizard.addScope({ path: result.path });
		dialog?.close();
	}

	function reset(): void {
		wizard.addFolderParentPath = undefined;
		path = '';
		problem = undefined;
	}
</script>

<dialog class="confirm-dialog add-folder" bind:this={dialog} aria-labelledby="add-folder-title" onclose={reset}>
	<h2 id="add-folder-title">Add a folder{parentPath === '' ? '' : ` inside ${parentPath}/`}</h2>
	<p>Its files hold only what it changes.</p>
	{#if unusedPresets.length > 0 && parentPath === ''}
		<div class="folder-presets">
			{#each unusedPresets as preset (preset.scope.path)}
				<button type="button" class="preset" onclick={() => addPreset(preset.scope.path)}>
					<strong><Icon name="folder" small />{preset.scope.path}/</strong>
					<span>{preset.description}</span>
				</button>
			{/each}
		</div>
	{/if}
	<form class="stack" onsubmit={addTyped}>
		<label class="field">
			<span>{parentPath === '' ? 'Or another folder' : 'Folder'}</span>
			<input aria-label="New folder" bind:value={path} placeholder="src/Legacy">
		</label>
		{#if problem}
			<p class="message danger" role="alert"><Icon name="errorCircle" /><span>{problem}</span></p>
		{/if}
		<div class="actions">
			<button type="submit" class="primary">Add folder</button>
			<button type="button" onclick={() => dialog?.close()}>Cancel</button>
		</div>
	</form>
</dialog>
