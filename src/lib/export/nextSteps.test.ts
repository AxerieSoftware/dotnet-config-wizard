import { expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { toPresetConfig } from '../config/presets.ts';
import { toGeneratedOutput } from './generatedOutput.ts';
import { toNextSteps } from './nextSteps.ts';

it('lists only the next steps the generated files need', () => {
	const catalog = readCatalog('10.0.4xx');
	const libraryConfig = toPresetConfig({ level: 'recommended', kind: 'library' }, catalog);
	const defaultsConfig = toPresetConfig({ level: 'microsoft-defaults', kind: 'any' }, catalog);

	const librarySteps = toNextSteps(libraryConfig, toGeneratedOutput(libraryConfig, catalog, { commentStyle: 'none' }).files).join('\n');
	const defaultsSteps = toNextSteps(defaultsConfig, toGeneratedOutput(defaultsConfig, catalog, { commentStyle: 'none' }).files).join('\n');

	expect(librarySteps).toContain('dotnet format --verify-no-changes');
	expect(librarySteps).toContain('packages.lock.json');
	expect(librarySteps).toContain('PublicAPI.Shipped.txt');
	expect(defaultsSteps).not.toContain('packages.lock.json');
	expect(defaultsSteps).not.toContain('PublicAPI');
});
