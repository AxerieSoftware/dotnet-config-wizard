import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Catalog, createCatalog } from '../src/lib/catalog/catalog.ts';
import type { SdkCatalogFile, StyleOptionCatalogFile } from '../src/lib/catalog/catalogFiles.ts';

const GENERATED_DIRECTORY = join(import.meta.dirname, '..', 'catalog', 'generated');

/** Reads the generated catalog for an SDK band, such as `10.0.3xx`. */
export function readCatalog(sdkBand: string): Catalog {
	const sdkCatalog = JSON.parse(readFileSync(join(GENERATED_DIRECTORY, `sdk-${sdkBand}.json`), 'utf8')) as SdkCatalogFile;
	const styleOptionCatalog = JSON.parse(readFileSync(join(GENERATED_DIRECTORY, 'style-options.json'), 'utf8')) as StyleOptionCatalogFile;
	return createCatalog(sdkCatalog, styleOptionCatalog);
}
