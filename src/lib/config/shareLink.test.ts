import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { applyMergePatch, toMergePatch } from './mergePatch.ts';
import { toPresetConfig } from './presets.ts';
import { decodeSavedState, encodeSavedState, restoreSavedState, SCHEMA_VERSION, toSavedState } from './shareLink.ts';

const catalog = readCatalog('10.0.4xx');

describe('mergePatch', () => {
	it('round-trips additions, changes and removals, replacing arrays whole', () => {
		const source = { a: 1, b: { c: 'x', d: 'y' }, list: [1, 2] };
		const target = { a: 1, b: { c: 'z' }, list: [3], e: true };

		const patch = toMergePatch(source, target);

		expect(patch).toEqual({ b: { c: 'z', d: null }, list: [3], e: true });
		expect(applyMergePatch(source, patch)).toEqual(target);
	});

	it('is empty when nothing changed', () => {
		expect(toMergePatch({ a: [1] }, { a: [1] })).toBeUndefined();
	});
});

describe('share links', () => {
	it('stores only what changed from the preset and restores the same config', () => {
		const config = toPresetConfig({ level: 'recommended', kind: 'any' }, catalog);
		const tests = config.scopes.find(scope => scope.path === 'tests');
		if (tests) tests.severities = { ...tests.severities, CA1822: 'none' };
		config.scopes.push({ path: 'src/Legacy', tfms: ['net10.0'] });

		const state = toSavedState(config, { level: 'recommended', kind: 'any' }, catalog);
		const restored = restoreSavedState(decodeSavedState(encodeSavedState(state)) ?? state, catalog);

		expect(state.changes).toEqual({ scopes: { tests: { severities: { CA1822: 'none' } }, 'src/Legacy': { path: 'src/Legacy', tfms: ['net10.0'] } } });
		expect(restored).toEqual({ status: 'restored', config, preset: { level: 'recommended', kind: 'any' } });
	});

	it('keeps an unchanged preset to a short link', () => {
		const state = toSavedState(toPresetConfig({ level: 'strict', kind: 'any' }, catalog), { level: 'strict', kind: 'any' }, catalog);

		expect(state.changes).toEqual({});
		expect(encodeSavedState(state).length).toBeLessThan(200);
	});

	it('refuses a link from a newer wizard', () => {
		const state = { ...toSavedState(toPresetConfig({ level: 'recommended', kind: 'any' }, catalog), { level: 'recommended', kind: 'any' }, catalog), schemaVersion: SCHEMA_VERSION + 1 };

		expect(restoreSavedState(state, catalog)).toEqual({ status: 'invalid', reason: 'This link was made by a newer version of the wizard.' });
	});

	it('ignores text that is not a share link', () => {
		expect(decodeSavedState('not-a-link')).toBeUndefined();
	});
});
