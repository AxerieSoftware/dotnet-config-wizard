<script lang="ts">
	import { BANDS } from '../catalog/loadCatalog.ts';
	import FoldersCard from './FoldersCard.svelte';
	import { PRESET_LEVEL_DETAILS, PRESET_LEVELS, type Preset, toPresetName } from './presets.ts';
	import { getWizardState } from './wizardState.svelte.ts';

	const wizard = getWizardState();
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

	function applyPreset(preset: Preset): void {
		wizard.confirmIfChanged({ title: 'Replace your settings?', message: `${toPresetName(preset)} replaces every setting, including the changes you made.`, confirmLabel: 'Replace settings' }, () =>
			wizard.applyPreset(preset)
		);
	}
</script>

<header class="step-header">
	<h1>Start</h1>
	<p>The SDK, preset and folders for the whole repo.</p>
</header>

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
	<p class="caption">SDK {wizard.catalog.band.sdkVersion} · {wizard.catalog.rules.size.toLocaleString('en-US')} rules</p>
</section>

<section class="card">
	<div class="card-header">
		<h2>Preset</h2>
		<p class="note">How strict the whole repo is. Changing it replaces every setting. From Recommended up, it adds src/ for libraries and tests/ for tests.</p>
	</div>
	<div class="preset-grid levels">
		{#each PRESET_LEVELS as level (level)}
			<button type="button" class="preset" class:selected={wizard.preset === level} aria-pressed={wizard.preset === level} onclick={() => applyPreset(level)}>
				<strong>{PRESET_LEVEL_DETAILS[level].title}</strong>
				<span>{PRESET_LEVEL_DETAILS[level].description}</span>
			</button>
		{/each}
	</div>
</section>

<FoldersCard />
