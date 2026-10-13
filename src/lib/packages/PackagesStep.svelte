<script lang="ts">
	import { BUILD_PROPERTIES } from '../build/buildProperties.ts';
	import PropertyEditor from '../build/PropertyEditor.svelte';
	import type { NuGetConfig, NuGetSource } from '../config/wizardConfig.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { NUGET_ORG, NUGET_ORG_AUDIT_ONLY_URL } from './nugetConfig.ts';

	const PACKAGE_GROUPS = ['Central package management', 'NuGet audit and lock files'];

	const wizard = getWizardState();
	const properties = BUILD_PROPERTIES.filter(property => PACKAGE_GROUPS.includes(property.group));
	const nuget = $derived(wizard.config.nuget);

	function setNuGetEnabled(isEnabled: boolean): void {
		wizard.setNuGetConfig(isEnabled ? { sources: [{ ...NUGET_ORG, patterns: ['*'] }], auditSourceUrl: NUGET_ORG.url } : undefined);
	}

	function updateNuGet(change: (current: NuGetConfig) => NuGetConfig): void {
		if (nuget) wizard.setNuGetConfig(change($state.snapshot(nuget)));
	}

	function updateSource(index: number, change: Partial<NuGetSource>): void {
		updateNuGet(current => ({ ...current, sources: current.sources.map((source, sourceIndex) => (sourceIndex === index ? { ...source, ...change } : source)) }));
	}
</script>

<header class="step-header">
	<h1>Packages</h1>
	<p>Central package management, NuGet audit, lock files and package sources.</p>
</header>

<ul class="note">
	<li>With central package management on, projects can't set <code>Version</code> on a PackageReference.</li>
	<li>Move each version to a <code>&lt;PackageVersion Include="…" Version="…" /&gt;</code> item in <code>Directory.Packages.props</code>.</li>
	<li>Analyzer packages are added for you as GlobalPackageReference items.</li>
</ul>

<PropertyEditor {properties} />

<section class="card">
	<div class="card-header">
		<h2>nuget.config</h2>
		<p class="note">Clears machine sources and maps each package to one source, blocking dependency confusion.</p>
	</div>
	<label class="checkbox">
		<input type="checkbox" checked={nuget !== undefined} onchange={event => setNuGetEnabled(event.currentTarget.checked)}>
		Generate nuget.config{wizard.isRootActive ? '' : ' (whole repo)'}
	</label>

	{#if nuget}
		{#each nuget.sources as source, index (index)}
			<div class="source-row">
				<label class="field"
					><span>Name</span><input aria-label={`Source ${index + 1} name`} value={source.key} onchange={event => updateSource(index, { key: event.currentTarget.value.trim() })}></label
				>
				<label class="field"
					><span>URL</span><input aria-label={`Source ${index + 1} URL`} value={source.url} onchange={event => updateSource(index, { url: event.currentTarget.value.trim() })}></label
				>
				<label class="field">
					<span>Package patterns</span>
					<input
						aria-label={`Source ${index + 1} patterns`}
						value={source.patterns.join(', ')}
						placeholder="Contoso.*, *"
						onchange={event =>
							updateSource(index, {
								patterns: event.currentTarget.value
									.split(',')
									.map(pattern => pattern.trim())
									.filter(pattern => pattern !== '')
							})}
					>
				</label>
				{#if nuget.sources.length > 1}
					<button type="button" class="subtle" onclick={() => updateNuGet(current => ({ ...current, sources: current.sources.filter((_, sourceIndex) => sourceIndex !== index) }))}>Remove</button>
				{/if}
			</div>
		{/each}
		<div class="actions">
			<button type="button" onclick={() => updateNuGet(current => ({ ...current, sources: [...current.sources, { key: 'private', url: '', patterns: ['Contoso.*'] }] }))}>Add a source</button>
		</div>
		<label class="field" style:max-width="480px">
			<span>Audit source</span>
			<select aria-label="Audit source" value={nuget.auditSourceUrl} onchange={event => updateNuGet(current => ({ ...current, auditSourceUrl: event.currentTarget.value }))}>
				<option value={NUGET_ORG.url}>nuget.org</option>
				<option value={NUGET_ORG_AUDIT_ONLY_URL}>nuget.org vulnerability data only (for networks that block api.nuget.org)</option>
			</select>
		</label>
	{/if}
</section>
