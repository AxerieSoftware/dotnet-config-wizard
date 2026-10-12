import { describe, expect, it } from 'vitest';
import { readBands, readCatalog } from '../../../scripts/readCatalog.ts';
import { findActiveOverlaps, OVERLAPS } from './overlaps.ts';

const catalog = readCatalog('10.0.4xx');

describe('overlaps', () => {
	it('lists only rule IDs and packages the catalog has', () => {
		const knownIds = new Set(readBands().flatMap(band => [...readCatalog(band.band).rules.keys()]));

		expect(OVERLAPS.flatMap(overlap => overlap.ruleIds).filter(id => !knownIds.has(id))).toEqual([]);
		expect(OVERLAPS.flatMap(overlap => overlap.packageIds ?? []).filter(id => !catalog.packages.has(id))).toEqual([]);
	});

	it('keeps the concern with the owner analyzer and flags the others', () => {
		const active = new Set(['CA2007', 'MA0004', 'RCS1090']);

		const [overlap] = findActiveOverlaps(catalog, rule => active.has(rule.id));

		expect(overlap.owner.id).toBe('CA2007');
		expect(overlap.duplicates.map(rule => rule.id)).toEqual(['MA0004', 'RCS1090']);
	});

	it('does not treat rules from the same analyzer as duplicates', () => {
		const active = new Set(['IDE0051', 'IDE0052']);

		expect(findActiveOverlaps(catalog, rule => active.has(rule.id))).toEqual([]);
	});

	it('treats every rule of a package listed against a concern as a duplicate', () => {
		const formattingRule = catalog.rules.values().find(rule => rule.packageId === 'Roslynator.Formatting.Analyzers');

		const [overlap] = findActiveOverlaps(catalog, rule => rule.id === 'IDE0055' || rule.id === formattingRule?.id);

		expect(overlap.concern).toBe('Formatting');
		expect(overlap.duplicates.map(rule => rule.id)).toEqual([formattingRule?.id]);
	});
});
