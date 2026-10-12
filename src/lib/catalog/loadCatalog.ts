import { type Catalog, createCatalog } from './catalog.ts';
import type { SdkCatalogFile, StyleOptionCatalogFile } from './catalogFiles.ts';

/** Loads the generated catalog in the browser as its own chunk, so pages render before the data arrives. */
export async function loadCatalog(): Promise<Catalog> {
	const [sdkCatalog, styleOptionCatalog] = await Promise.all([import('../../../catalog/generated/sdk-10.0.3xx.json'), import('../../../catalog/generated/style-options.json')]);
	return createCatalog(sdkCatalog.default as SdkCatalogFile, styleOptionCatalog.default as StyleOptionCatalogFile);
}
