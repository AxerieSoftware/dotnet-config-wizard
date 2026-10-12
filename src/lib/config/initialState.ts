import type { Catalog } from '../catalog/catalog.ts';
import { BANDS, DEFAULT_BAND, loadCatalog } from '../catalog/loadCatalog.ts';
import type { PresetId } from './presets.ts';
import { decodeSavedState, encodeSavedState, restoreSavedState, type SavedState } from './shareLink.ts';
import type { WizardConfig } from './wizardConfig.ts';

const STORAGE_KEY = 'dotnet-config-wizard';
const HASH_PREFIX = '#c=';

export type InitialState = { catalog: Catalog; restored?: { config: WizardConfig; presetId: PresetId }; notice?: string };

/** Starts from a share link in the URL, then from the browser's saved state, otherwise fresh on the default band. */
export async function loadInitialState(location: Location, storage: Storage | undefined): Promise<InitialState> {
	const fromLink = location.hash.startsWith(HASH_PREFIX) ? decodeSavedState(location.hash.slice(HASH_PREFIX.length)) : undefined;
	const saved = fromLink ?? readSavedState(storage);
	if (!saved) return { catalog: await loadCatalog(DEFAULT_BAND.band) };

	// A band that has since left support falls back to the default, and the restore skips rules it doesn't have.
	const bandName = BANDS.some(band => band.band === saved.sdkBand) ? saved.sdkBand : DEFAULT_BAND.band;
	const catalog = await loadCatalog(bandName);
	const result = restoreSavedState({ ...saved, sdkBand: bandName }, catalog);
	if (fromLink) history.replaceState(null, '', location.pathname);
	if (result.status === 'invalid') return { catalog, notice: result.reason };

	return { catalog, restored: { config: { ...result.config, versions: { sdkBand: bandName } }, presetId: result.presetId }, notice: result.notice };
}

/** The browser's localStorage, or undefined where reading it throws, such as when site data is blocked. */
export function getBrowserStorage(): Storage | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

export function saveState(storage: Storage | undefined, state: SavedState): void {
	try {
		storage?.setItem(STORAGE_KEY, encodeSavedState(state));
	} catch {
		// Storage can be full or blocked; the wizard keeps working without autosave.
	}
}

/** A link that reopens the wizard with these settings. */
export function toShareUrl(location: Location, state: SavedState): string {
	return `${location.origin}${location.pathname}${HASH_PREFIX}${encodeSavedState(state)}`;
}

function readSavedState(storage: Storage | undefined): SavedState | undefined {
	try {
		const text = storage?.getItem(STORAGE_KEY);
		return text ? decodeSavedState(text) : undefined;
	} catch {
		// Blocked storage reads like a first visit.
		return undefined;
	}
}
