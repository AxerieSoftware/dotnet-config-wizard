<script lang="ts">
	import { BANDS } from '../catalog/loadCatalog.ts';
	import { PRESET_KIND_DETAILS, PRESET_KINDS, PRESET_LEVEL_DETAILS, PRESET_LEVELS, type Preset, toPresetName } from './presets.ts';
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
	<p>The SDK and preset for the whole repo.</p>
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
		<p class="note">Changing either replaces every setting.</p>
	</div>
	<fieldset>
		<legend>Strictness</legend>
		<div class="preset-grid levels">
			{#each PRESET_LEVELS as level (level)}
				<button
					type="button"
					class="preset"
					class:selected={wizard.preset.level === level}
					aria-pressed={wizard.preset.level === level}
					onclick={() => applyPreset({ level, kind: wizard.preset.kind })}
				>
					<strong>{PRESET_LEVEL_DETAILS[level].title}</strong>
					<span>{PRESET_LEVEL_DETAILS[level].description}</span>
				</button>
			{/each}
		</div>
	</fieldset>
	<fieldset>
		<legend>Projects</legend>
		<div class="preset-grid kinds">
			{#each PRESET_KINDS as kind (kind)}
				<button type="button" class="preset" class:selected={wizard.preset.kind === kind} aria-pressed={wizard.preset.kind === kind} onclick={() => applyPreset({ level: wizard.preset.level, kind })}>
					<strong>{PRESET_KIND_DETAILS[kind].title}</strong>
					<span>{PRESET_KIND_DETAILS[kind].description}</span>
				</button>
			{/each}
		</div>
	</fieldset>
	<p class="caption">Project settings apply from Recommended up.</p>
</section>
