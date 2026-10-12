import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Catalog, createCatalog } from '../src/lib/catalog/catalog.ts';
import type { BandEntry, SdkCatalogFile, StyleOptionCatalogFile } from '../src/lib/catalog/catalogFiles.ts';

const GENERATED_DIRECTORY = join(import.meta.dirname, '..', 'catalog', 'generated');

/** Every band in the generated catalog, newest first. */
export function readBands(): BandEntry[] {
	return readJson<BandEntry[]>('bands.json');
}

/** Reads the generated catalog for an SDK band, such as `10.0.4xx`. */
export function readCatalog(bandName: string): Catalog {
	const band = readBands().find(entry => entry.band === bandName);
	if (!band) throw new Error(`The catalog has no SDK band '${bandName}'.`);

	return createCatalog(band, readJson<SdkCatalogFile>(`sdk-${bandName}.json`), readJson<StyleOptionCatalogFile>('style-options.json'));
}

function readJson<TValue>(fileName: string): TValue {
	return JSON.parse(readFileSync(join(GENERATED_DIRECTORY, fileName), 'utf8')) as TValue;
}
