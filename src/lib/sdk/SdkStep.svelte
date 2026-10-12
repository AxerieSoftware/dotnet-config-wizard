<script lang="ts">
	import { type GlobalJsonConfig, ROLL_FORWARD_POLICIES } from '../config/wizardConfig.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';

	const MSTEST_SDK = 'MSTest.Sdk';

	const wizard = getWizardState();
	const globalJson = $derived(wizard.config.globalJson);

	function update(change: Partial<GlobalJsonConfig>): void {
		if (globalJson) wizard.setGlobalJson({ ...$state.snapshot(globalJson), ...change });
	}

	function setMSTestSdkVersion(version: string): void {
		if (!globalJson) return;

		const msbuildSdks = { ...$state.snapshot(globalJson.msbuildSdks) };
		if (version) msbuildSdks[MSTEST_SDK] = version;
		else delete msbuildSdks[MSTEST_SDK];
		update({ msbuildSdks });
	}
</script>

<h1>SDK</h1>
<p class="lead"><code>global.json</code> pins the SDK every machine and CI agent builds with. It's the one place new analyzer rules and warning waves come from, since AnalysisLevel tracks it.</p>

{#if !wizard.isRootActive}
	<p class="note">global.json applies to the whole repo, whichever folder is selected.</p>
{/if}

<section class="card">
	<label class="checkbox">
		<input
			type="checkbox"
			checked={globalJson !== undefined}
			onchange={event => wizard.setGlobalJson(event.currentTarget.checked ? { rollForward: 'latestFeature', isTestingPlatformRunner: false, msbuildSdks: {} } : undefined)}
		>
		Generate global.json
	</label>

	{#if globalJson}
		<p class="note">Pins SDK {wizard.catalog.band.sdkVersion}{wizard.catalog.band.isPreview ? ', allowing prereleases because this band is a preview' : ''}.</p>
		<div class="field-grid">
			<label class="field">
				<span>Roll forward</span>
				<select aria-label="Roll forward" value={globalJson.rollForward} onchange={event => update({ rollForward: event.currentTarget.value as GlobalJsonConfig['rollForward'] })}>
					{#each ROLL_FORWARD_POLICIES as policy (policy)}
						<option value={policy}>{policy}</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span>MSTest.Sdk version</span>
				<input aria-label="MSTest.Sdk version" value={globalJson.msbuildSdks[MSTEST_SDK] ?? ''} placeholder="Not used" onchange={event => setMSTestSdkVersion(event.currentTarget.value.trim())}>
			</label>
		</div>
		<label class="checkbox">
			<input type="checkbox" checked={globalJson.isTestingPlatformRunner} onchange={event => update({ isTestingPlatformRunner: event.currentTarget.checked })}>
			Run <code>dotnet test</code> on Microsoft.Testing.Platform
		</label>
		<p class="note"><code>latestFeature</code> lets a newer patch or feature band of the same major build the repo; <code>disable</code> requires exactly this SDK.</p>
	{/if}
</section>
