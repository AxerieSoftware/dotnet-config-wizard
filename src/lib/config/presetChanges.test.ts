import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { toPresetChanges } from './presetChanges.ts';
import { type Preset, toPresetConfig } from './presets.ts';
import { toSavedState } from './shareLink.ts';

const catalog = readCatalog('10.0.4xx');
const STRICT: Preset = 'strict';

describe('toPresetChanges', () => {
	it('finds nothing for a preset as it ships', () => {
		const config = toPresetConfig(STRICT, catalog);

		expect(toPresetChanges(toSavedState(config, STRICT, catalog), config, catalog)).toEqual([]);
	});

	it('lists each changed setting with the preset value and the new one, and folders added or removed', () => {
		const config = toPresetConfig(STRICT, catalog);
		config.scopes[0].severities = { ...config.scopes[0].severities, IDE0040: 'error' };
		config.scopes = [...config.scopes.filter(scope => scope.path !== 'src'), { path: 'legacy', isIgnored: true }];

		expect(toPresetChanges(toSavedState(config, STRICT, catalog), config, catalog)).toEqual([
			{ folderPath: '', setting: 'Rule: IDE0040', presetValue: 'warning', value: 'error' },
			{ folderPath: 'src', setting: 'Folder', presetValue: 'in the preset', value: 'removed' },
			{ folderPath: 'legacy', setting: 'Folder', presetValue: 'not in the preset', value: 'added' }
		]);
	});

	it('names NuGet sources by their keys', () => {
		const config = toPresetConfig(STRICT, catalog);
		config.nuget = { sources: [{ key: 'contoso', url: 'https://pkgs.example.com/v3/index.json', patterns: ['Contoso.*'] }], auditSourceUrl: 'https://api.nuget.org/v3/index.json' };

		expect(toPresetChanges(toSavedState(config, STRICT, catalog), config, catalog).find(change => change.setting === 'nuget.config: sources')?.value).toBe('contoso');
	});
});
