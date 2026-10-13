import type { Catalog } from '../catalog/catalog.ts';
import { BANDS, DEFAULT_BAND, loadCatalog } from '../catalog/loadCatalog.ts';
import { clearSessionValues } from '../ui/sessionValue.svelte.ts';
import type { Preset } from './presets.ts';
import { decodeSavedState, encodeSavedState, restoreSavedState, type SavedState } from './shareLink.ts';
import type { WizardConfig } from './wizardConfig.ts';

const STORAGE_KEY = 'dotnet-config-wizard';
const HASH_PREFIX = '#c=';

/**
 * Where the wizard's settings came from. A share link replaces what the browser had saved, so `replacedSaved` keeps that
 * until the page is left, letting the user go back to it.
 */
export type InitialState = {
	catalog: Catalog;
	source: 'new' | 'browser' | 'link';
	restored?: { config: WizardConfig; preset: Preset };
	replacedSaved?: SavedState;
	notice?: string;
};

/** Starts from a share link in the URL, then from the browser's saved state, otherwise fresh on the default band. */
export async function loadInitialState(location: Location, storage: Storage | undefined): Promise<InitialState> {
	const fromLink = location.hash.startsWith(HASH_PREFIX) ? decodeSavedState(location.hash.slice(HASH_PREFIX.length)) : undefined;
	const fromBrowser = readSavedState(storage);
	if (fromLink) {
		history.replaceState(null, '', location.pathname);
		const linked = await restore(fromLink);
		if (linked.restored) return { ...linked, source: 'link', replacedSaved: fromBrowser };
		// A link that can't be restored leaves the settings saved in this browser in place.
		if (!fromBrowser) return { ...linked, source: 'new' };

		const browser = await restore(fromBrowser);
		return { ...browser, source: browser.restored ? 'browser' : 'new', notice: linked.notice };
	}

	if (!fromBrowser) return { catalog: await loadCatalog(DEFAULT_BAND.band), source: 'new' };
	const browser = await restore(fromBrowser);
	return { ...browser, source: browser.restored ? 'browser' : 'new' };
}

/** The browser's localStorage, or undefined where reading it throws, such as when site data is blocked. */
export function getBrowserStorage(): Storage | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

/**
 * Saves the settings, or forgets them while they're untouched, so a visit that changes nothing leaves nothing behind.
 * Returns whether the settings are now saved.
 */
export function saveState(storage: Storage | undefined, state: SavedState | undefined): boolean {
	if (!state) {
		forgetState(storage);
		return false;
	}

	try {
		storage?.setItem(STORAGE_KEY, encodeSavedState(state));
		return storage !== undefined;
	} catch {
		// Storage can be full or blocked; the wizard keeps working without autosave.
		return false;
	}
}

/** Forgets the saved settings and every remembered view, then reopens the wizard fresh. */
export function startOver(location: Location, storage: Storage | undefined): void {
	forgetState(storage);
	clearSessionValues();
	location.assign('/wizard/start');
}

/** Puts back the settings a share link replaced, then reloads them. */
export function restoreReplaced(location: Location, storage: Storage | undefined, replaced: SavedState): void {
	saveState(storage, replaced);
	location.reload();
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

function forgetState(storage: Storage | undefined): void {
	try {
		storage?.removeItem(STORAGE_KEY);
	} catch {
		// Blocked storage has nothing saved to forget.
	}
}

async function restore(saved: SavedState): Promise<Omit<InitialState, 'source'>> {
	// A band that has since left support falls back to the default, and the restore skips rules it doesn't have.
	const bandName = BANDS.some(band => band.band === saved.sdkBand) ? saved.sdkBand : DEFAULT_BAND.band;
	const catalog = await loadCatalog(bandName);
	const result = restoreSavedState({ ...saved, sdkBand: bandName }, catalog);
	if (result.status === 'invalid') return { catalog, notice: result.reason };

	return { catalog, restored: { config: { ...result.config, versions: { sdkBand: bandName } }, preset: result.preset } };
}
