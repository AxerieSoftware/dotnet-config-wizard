import bands from '../../../catalog/generated/bands.json';
import packages from '../../../catalog/generated/packages.json';
import ruleHistory from '../../../catalog/generated/rule-history.json';
import styleOptionCatalog from '../../../catalog/generated/style-options.json';
import { type Catalog, createCatalog } from './catalog.ts';
import type { BandEntry, PackageCatalogFile, PackageEntry, SdkCatalogFile, StyleOptionCatalogFile } from './catalogFiles.ts';

const SDK_CATALOGS = import.meta.glob<SdkCatalogFile>('../../../catalog/generated/sdk-*.json', { import: 'default' });
const PACKAGE_CATALOGS = import.meta.glob<PackageCatalogFile>('../../../catalog/generated/package-*.json', { import: 'default' });

/** Every SDK band the catalog covers, newest first. */
export const BANDS: readonly BandEntry[] = bands;

/** Every analyzer package the wizard offers, with its maintenance details. */
export const PACKAGES: readonly PackageEntry[] = packages;

/** The newest band that isn't a preview, which new configs start on. */
export const DEFAULT_BAND: BandEntry = BANDS.find(band => !band.isPreview) ?? BANDS[0];

/** Loads one band's rules and every package's rules as separate chunks, so switching bands only fetches that band. */
export async function loadCatalog(bandName: string): Promise<Catalog> {
	const band = BANDS.find(entry => entry.band === bandName);
	const loadSdkCatalog = SDK_CATALOGS[`../../../catalog/generated/sdk-${bandName}.json`];
	if (!band || !loadSdkCatalog) throw new Error(`The catalog has no SDK band '${bandName}'.`);

	const [sdkCatalog, ...packageCatalogs] = await Promise.all([loadSdkCatalog(), ...Object.values(PACKAGE_CATALOGS).map(loadPackageCatalog => loadPackageCatalog())]);
	return createCatalog(
		band,
		sdkCatalog as SdkCatalogFile,
		styleOptionCatalog as StyleOptionCatalogFile,
		PACKAGES as PackageEntry[],
		packageCatalogs as PackageCatalogFile[],
		ruleHistory as Record<string, string>
	);
}
