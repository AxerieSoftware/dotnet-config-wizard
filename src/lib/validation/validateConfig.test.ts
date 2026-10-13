import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { ALL_PRESETS, toPresetConfig, toPresetName } from '../config/presets.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import { validateConfig } from './validateConfig.ts';

const catalog = readCatalog('10.0.4xx');

function issuesFor(config: WizardConfig) {
	return validateConfig(config, catalog, toGeneratedOutput(config, catalog, { commentStyle: 'none' }).skippedKeys);
}

function toConfig(...scopes: ScopeConfig[]): WizardConfig {
	return { versions: { sdkBand: '10.0.4xx' }, scopes };
}

function messagesFor(config: WizardConfig) {
	return issuesFor(config).map(issue => `${issue.severity}: ${issue.message}`);
}

describe('validateConfig', () => {
	it.each(ALL_PRESETS.map(preset => ({ name: toPresetName(preset), preset })))('finds no errors or warnings in the $name preset', ({ preset }) => {
		expect(issuesFor(toPresetConfig(preset, catalog)).filter(issue => issue.severity !== 'info')).toEqual([]);
	});

	it.each(ALL_PRESETS.map(preset => ({ name: toPresetName(preset), preset })))('finds no folder settings that repeat what they inherit in the $name preset', ({ preset }) => {
		expect(issuesFor(toPresetConfig(preset, catalog)).filter(issue => issue.message.includes('repeat what this folder already inherits'))).toEqual([]);
	});

	it('errors when locked restore has no lock files to check', () => {
		expect(messagesFor(toConfig({ path: '', ciBuild: { RestoreLockedMode: 'true' } }))).toContain(
			'error: RestoreLockedMode needs RestorePackagesWithLockFile; without lock files every locked restore fails.'
		);
	});

	it('warns when locked restore applies outside CI', () => {
		expect(messagesFor(toConfig({ path: '', build: { RestorePackagesWithLockFile: 'true', RestoreLockedMode: 'true' } })).join('\n')).toContain('Limit it to CI builds.');
	});

	it('errors when XML docs are turned off while IDE0005 runs', () => {
		expect(messagesFor(toConfig({ path: '', build: { GenerateDocumentationFile: 'false' }, severities: { IDE0005: 'warning' } }))).toContain(
			'error: IDE0005 can only run on build when GenerateDocumentationFile is true.'
		);
	});

	it('warns that IDE rules only show in the editor without EnforceCodeStyleInBuild', () => {
		expect(messagesFor(toConfig({ path: '', severities: { IDE0055: 'warning', IDE0003: 'warning' } }))).toContain(
			"warning: IDE0055 only show in the editor until EnforceCodeStyleInBuild is true, so they won't fail a build."
		);
	});

	it('warns about ConfigureAwait and AOT library settings outside libraries', () => {
		const messages = messagesFor(toConfig({ path: '', projectKind: 'service', severities: { CA2007: 'warning' }, build: { IsAotCompatible: 'true' } })).join('\n');

		expect(messages).toContain('CA2007 (ConfigureAwait) only helps libraries');
		expect(messages).toContain('IsAotCompatible marks libraries');
	});

	it('warns about a computed copyright year', () => {
		expect(messagesFor(toConfig({ path: '', build: { Copyright: 'Copyright (c) Contoso $([System.DateTime]::Now.Year)' } })).join('\n')).toContain('A computed Copyright');
	});

	it('reports duplicates a folder inherits only on the folder they come from', () => {
		const config = toConfig({ path: '', packages: ['SonarAnalyzer.CSharp'], severities: { CA1822: 'warning', S2325: 'warning' } }, { path: 'tests' });

		const overlapIssues = issuesFor(config).filter(issue => issue.message.startsWith('Static members'));

		expect(overlapIssues.map(issue => issue.scopePath)).toEqual(['']);
	});

	it('notes library package metadata that nuget.org expects', () => {
		const withoutMetadata = issuesFor(toConfig({ path: '', projectKind: 'library' }));
		const withMetadata = issuesFor(toConfig({ path: '', projectKind: 'library', build: { PackageLicenseExpression: 'MIT', PackageReadmeFile: 'README.md', Authors: 'Contoso' } }));

		expect(withoutMetadata.map(issue => issue.message)).toContainEqual(expect.stringContaining('no PackageLicenseExpression, PackageReadmeFile, Authors'));
		expect(withMetadata.map(issue => issue.message)).not.toContainEqual(expect.stringContaining('Library packages here'));
	});

	it('warns about duplicate active rules', () => {
		expect(messagesFor(toConfig({ path: '', packages: ['Meziantou.Analyzer'], severities: { CA2007: 'warning', MA0004: 'warning' } })).join('\n')).toContain(
			'ConfigureAwait is checked by CA2007, MA0004'
		);
	});

	it('notes overrides that repeat the inherited value', () => {
		const config = toConfig({ path: '', severities: { CA1822: 'warning' } }, { path: 'tests', severities: { CA1822: 'warning', CA1707: 'none' } });

		expect(issuesFor(config)).toContainEqual({ severity: 'info', scopePath: 'tests', message: 'CA1822 repeat what this folder already inherits and can be removed.' });
	});

	it('errors on a NuGet source no package maps to', () => {
		const config: WizardConfig = {
			...toConfig({ path: '' }),
			nuget: {
				sources: [
					{ key: 'nuget.org', url: 'https://api.nuget.org/v3/index.json', patterns: ['*'] },
					{ key: 'contoso', url: 'https://pkgs.dev.azure.com/contoso/_packaging/feed/nuget/v3/index.json', patterns: [] }
				],
				auditSourceUrl: 'https://api.nuget.org/v3/index.json'
			}
		};

		expect(messagesFor(config)).toContain('error: NuGet source contoso has no package patterns, so package source mapping never uses it.');
	});

	it('reports settings left out of the files', () => {
		expect(messagesFor(toConfig({ path: '', tfms: ['net10.0'], severities: { IDE0410: 'warning' } }))).toContain('warning: IDE0410 is left out of the files: Needs C# 15.0.');
	});
});
