<script lang="ts">
	import { toFolderName } from '../export/fileTree.ts';
	import { toUnsetLabel } from '../ui/inheritedLabel.ts';
	import ValueSelect from '../ui/ValueSelect.svelte';
	import { getParentScope, resolveProjectKind } from './scopes.ts';
	import { PROJECT_KIND_TITLES, PROJECT_KINDS, type ProjectKind, type ScopeConfig } from './wizardConfig.ts';
	import { getWizardState } from './wizardState.svelte.ts';

	const wizard = getWizardState();
	const folders = $derived(wizard.config.scopes.map(scope => ({ scope, inheritedKind: toInheritedKind(scope) })).sort((left, right) => left.scope.path.localeCompare(right.scope.path)));

	function toInheritedKind(scope: ScopeConfig): ProjectKind | undefined {
		const parent = getParentScope(wizard.config, scope);
		return parent && resolveProjectKind(wizard.config, parent);
	}

	function toKindTitle(kind: string): string {
		return PROJECT_KIND_TITLES[kind as ProjectKind];
	}
</script>

<section class="card" aria-labelledby="folders-heading">
	<div class="card-header">
		<h2 id="folders-heading">Folders</h2>
		<p class="note">
			What each folder holds. The Build and Analyzers steps offer each folder only the settings that suit it. A folder's settings reach every project inside it, so keep libraries, apps and services,
			and tests in separate folders.
		</p>
	</div>

	<div class="rows">
		{#each folders as { scope, inheritedKind } (scope.path)}
			<div class="option-row">
				<span class="option-name"><code>{toFolderName(scope.path)}</code></span>
				{#if scope.isIgnored}
					<span class="caption">Ignored</span>
				{:else}
					<ValueSelect
						label={scope.path === '' ? 'What the repo root holds' : `What ${toFolderName(scope.path)} holds`}
						value={scope.projectKind}
						values={PROJECT_KINDS}
						toLabel={toKindTitle}
						unsetLabel={toUnsetLabel(inheritedKind && toKindTitle(inheritedKind), 'Not set')}
						fallbackValue={inheritedKind}
						onchange={value => wizard.setProjectKind(scope.path, value as ProjectKind | undefined)}
					/>
				{/if}
			</div>
		{/each}
	</div>

	<div class="actions">
		<button type="button" class="small" onclick={() => wizard.askToAddFolder()}>Add a folder</button>
	</div>
</section>
