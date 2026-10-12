// lz-string is CommonJS, so prerendering in Node only sees its default export.
import lzString from 'lz-string';
import type { Catalog } from '../catalog/catalog.ts';
import { applyMergePatch, toMergePatch } from './mergePatch.ts';
import { PRESET_IDS, PRESET_VERSION, type PresetId, toPresetConfig } from './presets.ts';
import type { ScopeConfig, WizardConfig } from './wizardConfig.ts';
import { parseWizardConfig } from './wizardConfig.ts';

/** Bumped when the config shape changes; links and saved state carry it so older ones can be migrated. */
export const SCHEMA_VERSION = 1;

/** What a share link or saved state holds: the preset it started from and only what changed since. */
export type SavedState = { schemaVersion: number; presetVersion: number; catalogVersion: string; sdkBand: string; presetId: PresetId; changes: unknown };

export type RestoreResult = { status: 'restored'; config: WizardConfig; presetId: PresetId; notice?: string } | { status: 'invalid'; reason: string };

// Scopes are keyed by path while diffing, so a change in one folder doesn't rewrite every folder after it.
type KeyedConfig = Omit<WizardConfig, 'scopes'> & { scopes: Record<string, ScopeConfig> };

export function toSavedState(config: WizardConfig, presetId: PresetId, catalog: Catalog): SavedState {
	const changes = toMergePatch(toKeyed(toPresetConfig(presetId, catalog)), toKeyed(config)) ?? {};
	return { schemaVersion: SCHEMA_VERSION, presetVersion: PRESET_VERSION, catalogVersion: catalog.version, sdkBand: config.versions.sdkBand, presetId, changes };
}

/** Rebuilds a config from saved state, given the catalog for the state's SDK band. */
export function restoreSavedState(state: SavedState, catalog: Catalog): RestoreResult {
	if (state.schemaVersion > SCHEMA_VERSION) return { status: 'invalid', reason: 'This link was made by a newer version of the wizard.' };

	const config = fromKeyed(applyMergePatch(toKeyed(toPresetConfig(state.presetId, catalog)), state.changes) as KeyedConfig);
	const parseResult = parseWizardConfig(config);
	if (parseResult.status === 'invalid') return { status: 'invalid', reason: `The saved settings aren't valid: ${parseResult.reason}` };

	const notice =
		state.presetVersion === PRESET_VERSION
			? undefined
			: `These settings were saved against an older version of the ${state.presetId} preset. Anything you didn't change follows the current preset, so check the result before using it.`;
	return { status: 'restored', config: parseResult.config, presetId: state.presetId, notice };
}

export function encodeSavedState(state: SavedState): string {
	return lzString.compressToEncodedURIComponent(JSON.stringify(state));
}

/** Decodes a share link's state, or returns undefined when the text isn't one. */
export function decodeSavedState(text: string): SavedState | undefined {
	try {
		const value = JSON.parse(lzString.decompressFromEncodedURIComponent(text) ?? '') as Partial<SavedState>;
		const isValid = typeof value.schemaVersion === 'number' && typeof value.presetVersion === 'number' && typeof value.sdkBand === 'string' && PRESET_IDS.includes(value.presetId as PresetId);
		return isValid ? (value as SavedState) : undefined;
	} catch {
		// A truncated or hand-edited link isn't a share link; the caller starts fresh.
		return undefined;
	}
}

function toKeyed(config: WizardConfig): KeyedConfig {
	return { ...config, scopes: Object.fromEntries(config.scopes.map(scope => [scope.path, scope])) };
}

function fromKeyed(config: KeyedConfig): WizardConfig {
	// The root scope always comes first; the rest keep their order.
	const scopes = Object.values(config.scopes).sort((left, right) => (left.path === '' ? -1 : right.path === '' ? 1 : 0));
	return { ...config, scopes };
}
