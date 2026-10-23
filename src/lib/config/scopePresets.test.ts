import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { PRESET_LEVELS, toPresetConfig } from './presets.ts';
import { toScopePath, toScopePreset } from './scopePresets.ts';

const catalog = readCatalog('10.0.4xx');

describe('toScopePreset', () => {
	it.each(PRESET_LEVELS.filter(preset => preset !== 'microsoft-defaults' && preset !== 'microsoft-conventions'))('adds src and tests with what the %s preset gives them', preset => {
		const config = toPresetConfig(preset, catalog);
		const root = { ...config, scopes: config.scopes.filter(scope => scope.path === '') };

		expect(toScopePreset('src', root, preset, catalog)).toEqual(config.scopes.find(scope => scope.path === 'src'));
		expect(toScopePreset('tests', root, preset, catalog)).toEqual(config.scopes.find(scope => scope.path === 'tests'));
	});

	it('leaves out what samples would set when the repo root already sets it', () => {
		const config = toPresetConfig('microsoft-defaults', catalog);
		config.scopes[0].build = { IsPackable: 'false' };
		config.scopes[0].severities = { CA2007: 'none', CS1591: 'none' };

		expect(toScopePreset('samples', config, 'microsoft-defaults', catalog)).toEqual({ path: 'samples', projectKind: 'service' });
	});
});

describe('toScopePath', () => {
	it.each([
		['tests', 'tests'],
		['/src/Legacy/', 'src/Legacy'],
		['./tools\\Generators', 'tools/Generators'],
		['src//Api', 'src/Api']
	])('normalizes %s to %s', (text, path) => {
		expect(toScopePath(text, [''])).toEqual({ status: 'valid', path });
	});

	it.each([
		['', 'Enter a folder, such as tests or src/Legacy.'],
		['../outside', 'The folder must be inside the repo.'],
		['tests', 'tests already has settings.']
	])('rejects %j', (text, reason) => {
		expect(toScopePath(text, ['', 'tests'])).toEqual({ status: 'invalid', reason });
	});
});
