<script lang="ts">
	import { PROJECTS_UNDER_TEST_FOLDER } from '../build/buildProperties.ts';
	import { toFrameworkProperty } from '../build/buildPropsFiles.ts';
	import Icon from '../ui/Icon.svelte';
	import { toUnsetLabel } from '../ui/inheritedLabel.ts';
	import ValueSelect from '../ui/ValueSelect.svelte';
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
	const scopeLabel = $derived(wizard.isRootActive ? 'the repo root' : `${wizard.activeScope.path}/`);
	const examplePrefix = $derived(wizard.config.projectNamePrefix ?? 'Contoso');

	function toggleTfm(tfm: string, isChecked: boolean): void {
		wizard.setTargetFrameworks(isChecked ? [...tfms, tfm] : tfms.filter(existing => existing !== tfm));
	}

	function setProjectNamePrefix(input: HTMLInputElement): void {
		wizard.setProjectNamePrefix(input.value);
		// When the cleaned-up prefix matches the stored one, the value binding doesn't refresh the field.
		input.value = wizard.config.projectNamePrefix ?? '';
	}

	function setOtherTfms(text: string): void {
		const typed = text
			.split(/[;,\s]+/)
			.map(tfm => tfm.trim())
			.filter(tfm => tfm !== '');
		wizard.setTargetFrameworks([...tfms.filter(tfm => offeredTfms.includes(tfm)), ...typed]);
	}
</script>

<section class="card">
	<div class="card-header">
		<h2>Projects in {scopeLabel}</h2>
		<p class="note">Frameworks set the C# version; the kind picks which properties show.</p>
	</div>
	<h3>Target frameworks</h3>
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
		<span>Platform-specific frameworks</span>
		<input
			aria-label="Platform-specific target frameworks"
			disabled={isInheritingTfms}
			value={otherTfms.join(';')}
			placeholder="net10.0-windows;net10.0-android"
			onchange={event => setOtherTfms(event.currentTarget.value)}
		>
	</label>
	<label class="checkbox">
		<input
			type="checkbox"
			aria-label="Set the target frameworks for every project here"
			data-setting="TargetFramework"
			disabled={tfms.length === 0}
			checked={wizard.resolvedActiveScope.isTargetFrameworkShared}
			onchange={event => wizard.setTargetFrameworkShared(event.currentTarget.checked)}
		>
		<span>
			Set <code>{toFrameworkProperty(tfms)}</code> for every project here, so project files can leave it out. A project can still set its own
			<code>TargetFramework</code>.
		</span>
	</label>
	<p class="caption" data-testid="effective-csharp">Compiles as C# {wizard.activeContext.csharpVersion}, the oldest framework's default.</p>
	{#if unsupportedTfms.length > 0}
		<p class="message danger" role="alert">
			<Icon name="errorCircle" /><span>SDK {wizard.catalog.band.band} can't target {unsupportedTfms.join(', ')}. Only .NET 10 and later are supported.</span>
		</p>
	{/if}
	<label class="field" style:max-width="320px">
		<span>Projects here are</span>
		<ValueSelect
			label="Project kind"
			value={wizard.activeScope.projectKind}
			values={PROJECT_KINDS}
			unsetLabel={toUnsetLabel(wizard.inheritedScope?.projectKind, 'Not set')}
			fallbackValue={wizard.inheritedScope?.projectKind}
			onchange={value => wizard.setProjectKind(value as ProjectKind | undefined)}
		/>
	</label>
	{#if wizard.isRootActive}
		<label class="field" style:max-width="320px">
			<span>Project name prefix</span>
			<input
				aria-label="Project name prefix"
				data-setting="ProjectNamePrefix"
				value={wizard.config.projectNamePrefix ?? ''}
				placeholder="Contoso"
				onchange={event => setProjectNamePrefix(event.currentTarget)}
			>
		</label>
		<p class="caption">
			Builds <code>Billing</code> as <code>{examplePrefix}.Billing</code> and its tests as
			<code>{examplePrefix}.Billing.Tests</code>, so short project names need no renaming. Projects already named with the prefix are left alone.
		</p>
	{/if}
	<label class="checkbox">
		<input
			type="checkbox"
			aria-label="Let tests use internal types"
			data-setting="InternalsVisibleTo"
			checked={wizard.resolvedActiveScope.areInternalsVisibleToTests}
			onchange={event => wizard.setInternalsVisibleToTests(event.currentTarget.checked)}
		>
		<span>Let each project's tests use its internal types. The test project must be named after it with <code>.Tests</code> on the end.</span>
	</label>
	<!-- Shown while on even outside a test folder, so it can always be turned off. -->
	{#if wizard.resolvedActiveScope.projectKind === 'test' || wizard.resolvedActiveScope.isProjectUnderTestReferenced}
		<label class="checkbox">
			<input
				type="checkbox"
				aria-label="Reference the project under test"
				data-setting="ProjectUnderTest"
				checked={wizard.resolvedActiveScope.isProjectUnderTestReferenced}
				onchange={event => wizard.setProjectUnderTestReferenced(event.currentTarget.checked)}
			>
			<span>
				Add each test project's reference to the project it covers, so project files don't need it: <code>Billing.Tests</code> references
				<code>{PROJECTS_UNDER_TEST_FOLDER}/Billing/Billing.csproj</code>. A test project with no matching project gets no reference.
			</span>
		</label>
	{/if}
</section>
