<script lang="ts">
	import { BANDS } from '../catalog/loadCatalog.ts';
	import ValueSelect from '../ui/ValueSelect.svelte';
	import { compareCSharpVersions, getDefaultCSharpVersion, getTargetFrameworksForChannel, isSupportedTargetFramework } from './targetFrameworks.ts';
	import { PROJECT_KINDS, type ProjectKind } from './wizardConfig.ts';
	import { getWizardState } from './wizardState.svelte.ts';

	const LANG_VERSIONS = ['14.0', '15.0'];

	const wizard = getWizardState();
	const newestCSharpVersion = $derived(getDefaultCSharpVersion(`net${wizard.catalog.band.channel}`));
	const langVersionChoices = $derived(['latest', ...LANG_VERSIONS.filter(version => compareCSharpVersions(version, newestCSharpVersion) <= 0)]);
	const offeredTfms = $derived(getTargetFrameworksForChannel(wizard.catalog.band.channel));
	const tfms = $derived(wizard.rootScope.tfms ?? []);
	const otherTfms = $derived(tfms.filter(tfm => !offeredTfms.includes(tfm)));
	// An SDK can't build a framework newer than itself, and the wizard doesn't support .NET Framework or .NET Standard.
	const unsupportedTfms = $derived(tfms.filter(tfm => !isSupportedTargetFramework(tfm) || !offeredTfms.some(offered => tfm.startsWith(offered))));
	let isLoadingBand = $state(false);

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
		wizard.setRootTargetFrameworks(isChecked ? [...tfms, tfm] : tfms.filter(existing => existing !== tfm));
	}

	function setOtherTfms(text: string): void {
		const typed = text
			.split(/[;,\s]+/)
			.map(tfm => tfm.trim())
			.filter(tfm => tfm !== '');
		wizard.setRootTargetFrameworks([...tfms.filter(tfm => offeredTfms.includes(tfm)), ...typed]);
	}
</script>

<h1>Start</h1>
<p class="lead">
	The SDK, language version and target frameworks decide which rules and options exist and which apply to your code. Anything that doesn't apply is hidden in later steps and left out of the files.
</p>

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
	<p class="note">SDK {wizard.catalog.band.sdkVersion}, with {wizard.catalog.rules.size} rules. The wizard supports .NET 10 and later.</p>
</section>

<section class="card">
	<h2>Language version</h2>
	<label class="field">
		<span>LangVersion</span>
		<ValueSelect
			label="LangVersion"
			value={wizard.config.versions.langVersion ?? undefined}
			values={langVersionChoices}
			unsetLabel="Default for the target frameworks"
			onchange={value => wizard.setLangVersion(value)}
		/>
	</label>
	<p class="note" data-testid="effective-csharp">Code compiles as C# {wizard.rootContext.csharpVersion}.</p>
</section>

<section class="card">
	<h2>Target frameworks</h2>
	<div class="checkbox-grid">
		{#each offeredTfms as tfm (tfm)}
			<label class="checkbox"><input type="checkbox" checked={tfms.includes(tfm)} onchange={event => toggleTfm(tfm, event.currentTarget.checked)}> <code>{tfm}</code></label>
		{/each}
	</div>
	<label class="field">
		<span>Platform-specific target frameworks, separated by semicolons</span>
		<input aria-label="Platform-specific target frameworks" value={otherTfms.join(';')} placeholder="net10.0-windows;net10.0-android" onchange={event => setOtherTfms(event.currentTarget.value)}>
	</label>
	{#if unsupportedTfms.length > 0}
		<p class="warning" role="alert">SDK {wizard.catalog.band.band} can't target {unsupportedTfms.join(', ')}. The wizard supports .NET 10 and later only, with no .NET Framework or .NET Standard.</p>
	{/if}
</section>

<section class="card">
	<h2>Project kind</h2>
	<label class="field">
		<span>Most projects in the repo are</span>
		<ValueSelect
			label="Project kind"
			value={wizard.rootScope.projectKind}
			values={PROJECT_KINDS}
			unsetLabel="Not set"
			onchange={value => wizard.setRootProjectKind(value as ProjectKind | undefined)}
		/>
	</label>
</section>
