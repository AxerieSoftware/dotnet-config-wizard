import { expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import { toEffectiveFiles } from './effectiveFiles.ts';
import { toGeneratedOutput } from './generatedOutput.ts';

it('merges a folder with everything it inherits and marks only the lines the folder sets', () => {
	const catalog = readCatalog('10.0.4xx');
	const config: WizardConfig = {
		versions: { sdkBand: '10.0.4xx' },
		scopes: [
			{ path: '', severities: { CA1707: 'warning', CA1822: 'warning' }, build: { Nullable: 'enable' } },
			{ path: 'tests', severities: { CA1707: 'none' }, build: { IsPackable: 'false' } }
		]
	};
	const folderFiles = toGeneratedOutput(config, catalog, { commentStyle: 'none' }).files;

	const files = toEffectiveFiles(config, config.scopes[1], catalog, 'none', folderFiles);
	const editorConfig = files.find(file => file.path === '.editorconfig');
	const buildProps = files.find(file => file.path === 'Directory.Build.props');

	expect(editorConfig?.content).toContain('dotnet_diagnostic.CA1707.severity = none');
	expect(editorConfig?.content).toContain('dotnet_diagnostic.CA1822.severity = warning');
	expect([...(editorConfig?.ownLines ?? [])]).toEqual(['dotnet_diagnostic.CA1707.severity = none']);
	expect(buildProps?.content).toContain('<Nullable>enable</Nullable>');
	expect([...(buildProps?.ownLines ?? [])]).toEqual(['<IsPackable>false</IsPackable>']);
});
