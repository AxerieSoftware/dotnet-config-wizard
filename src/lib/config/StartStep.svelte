<script lang="ts">
	import { BANDS } from '../catalog/loadCatalog.ts';
	import ImportCard from '../import/ImportCard.svelte';
	import { toUnsetLabel } from '../ui/inheritedLabel.ts';
	import ValueSelect from '../ui/ValueSelect.svelte';
	import { PRESET_IDS, PRESETS } from './presets.ts';
	import { SCOPE_PRESETS, toScopePath } from './scopePresets.ts';
	import { getTargetFrameworksForChannel, isSupportedTargetFramework } from './targetFrameworks.ts';
	import { PROJECT_KINDS, type ProjectKind } from './wizardConfig.ts';
	import { getWizardState } from './wizardState.svelte.ts';

	const wizard = getWizardState();
	const offeredTfms = $derived(getTargetFrameworksForChannel(wizard.catalog.band.channel));
	const isInheritingTfms = $derived(!wizard.isRootActive && wizard.activeScope.tfms === undefined);
	const tfms = $derived(wizard.resolvedActiveScope.tfms);
	const otherTfms = $derived(tfms.filter(tfm => !offeredTfms.includes(tfm)));
	// An SDK can't build a framework newer than itself, and the wizard doesn't support .NET Framework or .NET Standard.
	const unsupportedTfms = $derived(tfms.filter(tfm => !isSupportedTargetFramework(tfm) || !offeredTfms.some(offered => tfm.startsWith(offered))));
	const existingPaths = $derived(wizard.config.scopes.map(scope => scope.path));
	const unusedPresets = $derived(SCOPE_PRESETS.filter(preset => !existingPaths.includes(preset.scope.path)));
	const scopeLabel = $derived(wizard.isRootActive ? 'the whole repo' : `${wizard.activeScope.path}/`);

	let isLoadingBand = $state(false);
	let newFolder = $state('');
	let newFolderProblem = $state<string | undefined>(undefined);

	function toBandLabel(band: (typeof BANDS)[number]): string {
		if (band.isPreview) return `${band.band} (preview)`;
		const support = band.endOfLifeDate ? `supported until ${band.endOfLifeDate}` : band.supportPhase;
		return `${band.band} (${band.releaseType.toUpperCase()}, ${support})`;
	}

	async function selectBand(bandName: string): Promise<void> {
		isLoadingBand = true;
		await wizard.selectBand(bandName);
		isLoadingBand = false;
	}

	function toggleTfm(tfm: string, isChecked: boolean): void {
		wizard.setTargetFrameworks(isChecked ? [...tfms, tfm] : tfms.filter(existing => existing !== tfm));
	}

	function setOtherTfms(text: string): void {
		const typed = text
			.split(/[;,\s]+/)
			.map(tfm => tfm.trim())
			.filter(tfm => tfm !== '');
		wizard.setTargetFrameworks([...tfms.filter(tfm => offeredTfms.includes(tfm)), ...typed]);
	}

	function addFolder(): void {
		const result = toScopePath(newFolder, existingPaths);
		if (result.status === 'invalid') {
			newFolderProblem = result.reason;
			return;
		}

		wizard.addScope({ path: result.path });
		newFolder = '';
		newFolderProblem = undefined;
	}
</script>

<h1>Start</h1>
<p class="lead">The SDK and target frameworks decide which rules and options exist and which apply to your code. Folders can each have their own settings, such as relaxed rules for tests.</p>

<section class="card">
	<h2>Start from a preset</h2>
	<p class="note">A preset replaces every setting. Pick the SDK first, since presets only use rules it has.</p>
	<div class="preset-grid">
		{#each PRESET_IDS as presetId (presetId)}
			<button type="button" class="preset" class:selected={wizard.presetId === presetId} aria-pressed={wizard.presetId === presetId} onclick={() => wizard.applyPreset(presetId)}>
				<strong>{PRESETS[presetId].title}</strong>
				<span>{PRESETS[presetId].description}</span>
			</button>
		{/each}
	</div>
</section>

<ImportCard />

<section class="card">
	<h2>.NET SDK</h2>
	<label class="field">
		<span>SDK band</span>
		<select aria-label="SDK band" value={wizard.catalog.band.band} disabled={isLoadingBand} onchange={event => selectBand(event.currentTarget.value)}>
			{#each BANDS as band (band.band)}
				<option value={band.band}>{toBandLabel(band)}</option>
			{/each}
		</select>
	</label>
	<p class="note">SDK {wizard.catalog.band.sdkVersion}, with {wizard.catalog.rules.size} rules. The wizard supports .NET 10 and later. This applies to the whole repo.</p>
</section>

<section class="card">
	<h2>Folders</h2>
	<p class="note">
		Each folder gets its own .editorconfig and props files holding only what it changes. Settings for a folder apply to everything inside it. Pick the folder to edit at the top of each step.
	</p>
	{#each wizard.config.scopes as scope (scope.path)}
		<div class="rule-row">
			<span><code>{scope.path === '' ? 'Root (whole repo)' : `${scope.path}/`}</code> {scope.projectKind ?? ''}</span>
			{#if scope.path !== ''}
				<button type="button" class="secondary" onclick={() => wizard.removeScope(scope.path)}>Remove {scope.path}</button>
			{/if}
		</div>
	{/each}
	<div class="actions wrap">
		{#each unusedPresets as preset (preset.scope.path)}
			<button type="button" class="secondary" onclick={() => wizard.addScope(preset.scope)}>Add {preset.title}</button>
		{/each}
	</div>
	<div class="actions">
		<input aria-label="New folder" bind:value={newFolder} placeholder="src/Legacy">
		<button type="button" class="secondary" onclick={addFolder}>Add folder</button>
	</div>
	{#if newFolderProblem}
		<p class="warning" role="alert">{newFolderProblem}</p>
	{/if}
</section>

<section class="card">
	<h2>Target frameworks for {scopeLabel}</h2>
	{#if !wizard.isRootActive}
		<label class="checkbox">
			<input type="checkbox" checked={isInheritingTfms} onchange={event => wizard.setTargetFrameworks(event.currentTarget.checked ? undefined : [...tfms])}>
			Same as the folder above
		</label>
	{/if}
	<div class="checkbox-grid">
		{#each offeredTfms as tfm (tfm)}
			<label class="checkbox"
				><input type="checkbox" disabled={isInheritingTfms} checked={tfms.includes(tfm)} onchange={event => toggleTfm(tfm, event.currentTarget.checked)}> <code>{tfm}</code></label
			>
		{/each}
	</div>
	<label class="field">
		<span>Platform-specific target frameworks, separated by semicolons</span>
		<input
			aria-label="Platform-specific target frameworks"
			disabled={isInheritingTfms}
			value={otherTfms.join(';')}
			placeholder="net10.0-windows;net10.0-android"
			onchange={event => setOtherTfms(event.currentTarget.value)}
		>
	</label>
	<p class="note" data-testid="effective-csharp">
		Code compiles as C# {wizard.activeContext.csharpVersion}, the default for the oldest target framework. The wizard never sets LangVersion: Microsoft doesn't support a C# version newer than the
		target framework's.
	</p>
	{#if unsupportedTfms.length > 0}
		<p class="warning" role="alert">SDK {wizard.catalog.band.band} can't target {unsupportedTfms.join(', ')}. The wizard supports .NET 10 and later only, with no .NET Framework or .NET Standard.</p>
	{/if}
</section>

<section class="card">
	<h2>Project kind for {scopeLabel}</h2>
	<label class="field">
		<span>Projects here are</span>
		<ValueSelect
			label="Project kind"
			value={wizard.activeScope.projectKind}
			values={PROJECT_KINDS}
			unsetLabel={toUnsetLabel(wizard.inheritedScope?.projectKind, 'Not set')}
			onchange={value => wizard.setProjectKind(value as ProjectKind | undefined)}
		/>
	</label>
	<p class="note">The kind decides which build properties the Build step offers, such as package metadata for libraries.</p>
</section>
