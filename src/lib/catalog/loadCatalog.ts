import bands from '../../../catalog/generated/bands.json';
import styleOptionCatalog from '../../../catalog/generated/style-options.json';
import { type Catalog, createCatalog } from './catalog.ts';
import type { BandEntry, SdkCatalogFile, StyleOptionCatalogFile } from './catalogFiles.ts';

const SDK_CATALOGS = import.meta.glob<SdkCatalogFile>('../../../catalog/generated/sdk-*.json', { import: 'default' });

/** Every SDK band the catalog covers, newest first. */
export const BANDS: readonly BandEntry[] = bands;

/** The newest band that isn't a preview, which new configs start on. */
export const DEFAULT_BAND: BandEntry = BANDS.find(band => !band.isPreview) ?? BANDS[0];

/** Loads one band's rules as its own chunk, so switching bands only fetches that band. */
export async function loadCatalog(bandName: string): Promise<Catalog> {
	const band = BANDS.find(entry => entry.band === bandName);
	const loadSdkCatalog = SDK_CATALOGS[`../../../catalog/generated/sdk-${bandName}.json`];
	if (!band || !loadSdkCatalog) throw new Error(`The catalog has no SDK band '${bandName}'.`);

	return createCatalog(band, await loadSdkCatalog(), styleOptionCatalog as StyleOptionCatalogFile);
}
