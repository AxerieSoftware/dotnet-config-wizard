import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { applyMergePatch, toMergePatch } from './mergePatch.ts';
import { toPresetConfig, toPresetConfigWithSource } from './presets.ts';
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
		const config = toPresetConfig('recommended', catalog);
		const tests = config.scopes.find(scope => scope.path === 'tests');
		if (tests) tests.severities = { ...tests.severities, CA1822: 'none' };
		config.scopes.push({ path: 'src/Legacy', tfms: ['net10.0'] });

		const state = toSavedState(config, 'recommended', catalog);
		const restored = restoreSavedState(decodeSavedState(encodeSavedState(state)) ?? state, catalog);

		expect(state.changes).toEqual({ scopes: { tests: { severities: { CA1822: 'none' } }, 'src/Legacy': { path: 'src/Legacy', tfms: ['net10.0'] } } });
		expect(restored).toEqual({ status: 'restored', config, preset: 'recommended' });
	});

	it('keeps an unchanged preset to a short link', () => {
		const state = toSavedState(toPresetConfig('strict', catalog), 'strict', catalog);

		expect(state.changes).toEqual({});
		expect(encodeSavedState(state).length).toBeLessThan(200);
	});

	it('refuses a link from a newer wizard', () => {
		const state = { ...toSavedState(toPresetConfig('recommended', catalog), 'recommended', catalog), schemaVersion: SCHEMA_VERSION + 1 };

		expect(restoreSavedState(state, catalog)).toEqual({ status: 'invalid', reason: 'This link was made by a newer version of the wizard.' });
	});

	it('opens a version 1 link with the settings it had, from when the preset named what src held', () => {
		// Version 1 links held the level and kind, and changes from that preset; this one turned off one rule in src.
		const legacyState = { schemaVersion: 1, sdkBand: '10.0.4xx', preset: { level: 'strict', kind: 'service' }, changes: { scopes: { src: { severities: { CA1822: 'none' } } } } } as const;
		const expected = toPresetConfigWithSource('strict', 'service', catalog);
		const expectedSource = expected.scopes.find(scope => scope.path === 'src');
		if (expectedSource) expectedSource.severities = { ...expectedSource.severities, CA1822: 'none' };

		const restored = restoreSavedState(decodeSavedState(encodeSavedState(legacyState)) ?? legacyState, catalog);

		expect(restored).toEqual({ status: 'restored', config: expected, preset: 'strict' });
	});

	it('opens a version 1 link for any project with src holding no kind', () => {
		const legacyState = { schemaVersion: 1, sdkBand: '10.0.4xx', preset: { level: 'recommended', kind: 'any' }, changes: {} } as const;

		const restored = restoreSavedState(legacyState, catalog);

		expect(restored.status === 'restored' && restored.config.scopes.find(scope => scope.path === 'src')).toEqual({ path: 'src' });
	});

	it('ignores text that is not a share link', () => {
		expect(decodeSavedState('not-a-link')).toBeUndefined();
	});
});
