import { expect, it } from 'vitest';
import { readBands, readCatalog } from '../../../scripts/readCatalog.ts';
import { MINIMUM_CSHARP_VERSIONS, MINIMUM_TARGET_FRAMEWORKS } from './versionOverlay.ts';

it('lists only rule IDs some cataloged band has', () => {
	const knownIds = new Set(readBands().flatMap(band => [...readCatalog(band.band).rules.keys()]));
	const unknownIds = [...Object.keys(MINIMUM_CSHARP_VERSIONS), ...Object.keys(MINIMUM_TARGET_FRAMEWORKS)].filter(id => !knownIds.has(id));

	expect(unknownIds).toEqual([]);
});
