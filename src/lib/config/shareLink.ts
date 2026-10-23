// lz-string is CommonJS, so prerendering in Node only sees its default export.
import lzString from 'lz-string';
import type { Catalog } from '../catalog/catalog.ts';
import { applyMergePatch, toMergePatch } from './mergePatch.ts';
import { PRESET_LEVELS, type Preset, toPresetConfig, toPresetConfigWithSource } from './presets.ts';
import type { ProjectKind, ScopeConfig, WizardConfig } from './wizardConfig.ts';
import { parseWizardConfig } from './wizardConfig.ts';

/** Bumped when the config shape changes; links and saved state carry it so older ones can be migrated. */
export const SCHEMA_VERSION = 2;
const LEGACY_SCHEMA_VERSION = 1;
const LEGACY_PRESET_KINDS = ['any', 'library', 'service'] as const;

/** What a share link or saved state holds: the preset it started from and only what changed since. */
export type SavedState = { schemaVersion: number; sdkBand: string; preset: Preset; changes: unknown };

/** Version 1 state, from when a preset also said what src holds: any project, libraries, or apps and services. */
type LegacySavedState = { schemaVersion: typeof LEGACY_SCHEMA_VERSION; sdkBand: string; preset: { level: Preset; kind: LegacyPresetKind }; changes: unknown };
type LegacyPresetKind = (typeof LEGACY_PRESET_KINDS)[number];

/** Saved state of any version a link or the browser may still hold. */
export type StoredState = SavedState | LegacySavedState;

export type RestoreResult = { status: 'restored'; config: WizardConfig; preset: Preset } | { status: 'invalid'; reason: string };

// Scopes are keyed by path while diffing, so a change in one folder doesn't rewrite every folder after it.
type KeyedConfig = Omit<WizardConfig, 'scopes'> & { scopes: Record<string, ScopeConfig> };

export function toSavedState(config: WizardConfig, preset: Preset, catalog: Catalog): SavedState {
	const changes = toMergePatch(toKeyed(toPresetConfig(preset, catalog)), toKeyed(config)) ?? {};
	return { schemaVersion: SCHEMA_VERSION, sdkBand: config.versions.sdkBand, preset, changes };
}

/** Rebuilds a config from saved state of any version, given the catalog for the state's SDK band. */
export function restoreSavedState(state: StoredState, catalog: Catalog): RestoreResult {
	if (state.schemaVersion > SCHEMA_VERSION) return { status: 'invalid', reason: 'This link was made by a newer version of the wizard.' };

	const { preset, presetConfig } = toPresetStart(state, catalog);
	const config = fromKeyed(applyMergePatch(toKeyed(presetConfig), state.changes) as KeyedConfig);
	const parseResult = parseWizardConfig(config);
	if (parseResult.status === 'invalid') return { status: 'invalid', reason: `The saved settings aren't valid: ${parseResult.reason}` };

	return { status: 'restored', config: parseResult.config, preset };
}

/**
 * The preset saved changes apply to. Version 1 changes apply to the preset as it was then, with src holding the kind of
 * project it named, so an old link opens with the settings it had.
 */
function toPresetStart(state: StoredState, catalog: Catalog): { preset: Preset; presetConfig: WizardConfig } {
	if (!isLegacyState(state)) return { preset: state.preset, presetConfig: toPresetConfig(state.preset, catalog) };

	const { level, kind } = state.preset;
	return { preset: level, presetConfig: toPresetConfigWithSource(level, toSourceKind(kind), catalog) };
}

function isLegacyState(state: StoredState): state is LegacySavedState {
	return state.schemaVersion === LEGACY_SCHEMA_VERSION;
}

function toSourceKind(kind: LegacyPresetKind): ProjectKind | undefined {
	return kind === 'any' ? undefined : kind;
}

export function encodeSavedState(state: StoredState): string {
	return lzString.compressToEncodedURIComponent(JSON.stringify(state));
}

/** Decodes a share link's state, or returns undefined when the text isn't one. */
export function decodeSavedState(text: string): StoredState | undefined {
	try {
		const value = JSON.parse(lzString.decompressFromEncodedURIComponent(text) ?? '') as Partial<SavedState> | Partial<LegacySavedState>;
		if (typeof value.schemaVersion !== 'number' || typeof value.sdkBand !== 'string') return undefined;
		const isValid = value.schemaVersion === LEGACY_SCHEMA_VERSION ? isLegacyPreset(value.preset) : PRESET_LEVELS.includes(value.preset as Preset);
		return isValid ? (value as StoredState) : undefined;
	} catch {
		// A truncated or hand-edited link isn't a share link; the caller starts fresh.
		return undefined;
	}
}

function isLegacyPreset(value: unknown): value is LegacySavedState['preset'] {
	const preset = value as Partial<LegacySavedState['preset']> | undefined;
	return PRESET_LEVELS.includes(preset?.level as Preset) && LEGACY_PRESET_KINDS.includes(preset?.kind as LegacyPresetKind);
}

/** The config with scopes keyed by path, which diffs compare folder by folder. */
export function toKeyed(config: WizardConfig): KeyedConfig {
	return { ...config, scopes: Object.fromEntries(config.scopes.map(scope => [scope.path, scope])) };
}

function fromKeyed(config: KeyedConfig): WizardConfig {
	// The root scope always comes first; the rest keep their order.
	const scopes = Object.values(config.scopes).sort((left, right) => (left.path === '' ? -1 : right.path === '' ? 1 : 0));
	return { ...config, scopes };
}
