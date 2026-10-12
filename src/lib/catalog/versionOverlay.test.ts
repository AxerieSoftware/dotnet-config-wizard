import { expect, it } from 'vitest';
import { readBands, readCatalog } from '../../../scripts/readCatalog.ts';
import { MINIMUM_CSHARP_VERSIONS } from './versionOverlay.ts';

it('lists only rule IDs some cataloged band has', () => {
	const knownIds = new Set(readBands().flatMap(band => [...readCatalog(band.band).rules.keys()]));
	const unknownIds = Object.keys(MINIMUM_CSHARP_VERSIONS).filter(id => !knownIds.has(id));

	expect(unknownIds).toEqual([]);
});
