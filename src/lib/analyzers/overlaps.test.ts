import { describe, expect, it } from 'vitest';
import { readBands, readCatalog } from '../../../scripts/readCatalog.ts';
import { findActiveOverlaps, findCoveringRuleIds, OVERLAPS } from './overlaps.ts';

const catalog = readCatalog('10.0.4xx');

describe('overlaps', () => {
	it('lists only rule IDs the catalog has', () => {
		const knownIds = new Set(readBands().flatMap(band => [...readCatalog(band.band).rules.keys()]));

		expect(OVERLAPS.flatMap(overlap => overlap.ruleIds).filter(id => !knownIds.has(id))).toEqual([]);
	});

	it('keeps the concern with the owner analyzer and flags the others', () => {
		const active = new Set(['CA2007', 'MA0004', 'VSTHRD111']);

		const [overlap] = findActiveOverlaps(catalog, rule => active.has(rule.id));

		expect(overlap.owner.id).toBe('CA2007');
		expect(overlap.duplicates.map(rule => rule.id)).toEqual(['VSTHRD111', 'MA0004']);
	});

	it('names the active rule that covers a duplicate that is off', () => {
		const active = new Set(['CA2214']);

		const coveringIds = findCoveringRuleIds(catalog, rule => active.has(rule.id));

		expect(coveringIds.get('S1699')).toBe('CA2214');
		expect(coveringIds.get('MA0056')).toBe('CA2214');
		expect(coveringIds.has('CA2214')).toBe(false);
	});

	it('does not treat rules from the same analyzer as duplicates', () => {
		const active = new Set(['IDE0051', 'IDE0052']);

		expect(findActiveOverlaps(catalog, rule => active.has(rule.id))).toEqual([]);
	});
});
