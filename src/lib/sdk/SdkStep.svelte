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

<header class="step-header">
	<h1>SDK</h1>
	<p><code>global.json</code> pins the SDK everywhere. Updating it brings new rules and warning waves.</p>
</header>

<section class="card">
	<label class="checkbox">
		<input
			type="checkbox"
			checked={globalJson !== undefined}
			onchange={event => wizard.setGlobalJson(event.currentTarget.checked ? { rollForward: 'latestFeature', isTestingPlatformRunner: false, msbuildSdks: {} } : undefined)}
		>
		Generate global.json{wizard.isRootActive ? '' : ' (whole repo)'}
	</label>

	{#if globalJson}
		<p class="caption">Pins SDK {wizard.catalog.band.sdkVersion}{wizard.catalog.band.isPreview ? ', prereleases allowed.' : '.'}</p>
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
		<ul class="caption">
			<li><code>latestFeature</code>: a newer patch or feature band of the same major can build the repo.</li>
			<li><code>disable</code>: only this exact SDK can.</li>
		</ul>
	{/if}
</section>
