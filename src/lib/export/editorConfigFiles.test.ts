import { describe, expect, it } from 'vitest';
import { readBands, readCatalog } from '../../../scripts/readCatalog.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import { NAMING_TEMPLATES } from '../naming/namingRule.ts';
import { checkEditorConfigKeys } from './checkEditorConfigKeys.ts';
import { toEditorConfigFiles } from './editorConfigFiles.ts';
import { toExhaustiveConfig } from './exhaustiveConfig.ts';

const BAND = '10.0.4xx';
const catalog = readCatalog(BAND);

function toConfig(...scopes: ScopeConfig[]): WizardConfig {
	return { versions: { sdkBand: BAND, langVersion: null }, scopes };
}

function toRootOutput(scope: Omit<ScopeConfig, 'path'>, commentStyle: 'none' | 'idAndTitle' = 'idAndTitle') {
	const output = toEditorConfigFiles(toConfig({ path: '', tfms: ['net10.0'], ...scope }), catalog, { commentStyle });
	return { content: output.files[0].content, skippedKeys: output.skippedKeys.map(({ key, reason }) => ({ key, reason })) };
}

describe('toEditorConfigFiles', () => {
	it.each(readBands().map(band => band.band))('renders every option, rule and naming template of SDK %s as keys Roslyn reads', band => {
		const bandCatalog = readCatalog(band);
		const output = toEditorConfigFiles(toExhaustiveConfig(bandCatalog), bandCatalog, { commentStyle: 'titleAndLink' });

		expect(output.files.map(file => file.path)).toEqual(['.editorconfig', 'tests/.editorconfig']);
		expect(output.skippedKeys).toEqual([]);
		for (const file of output.files) expect(checkEditorConfigKeys(file.content, bandCatalog)).toEqual([]);
	});

	it('leaves out and reports keys the catalog does not know', () => {
		const file = toRootOutput({ options: { not_an_option: 'true' }, severities: { CA9999: 'warning' } });

		expect(file.skippedKeys.map(skipped => skipped.key)).toEqual(['not_an_option', 'CA9999']);
		expect(file.content).not.toContain('not_an_option');
		expect(file.content).not.toContain('CA9999');
	});

	it('marks rules that only run in the editor', () => {
		const file = toRootOutput({ severities: { IDE0003: 'warning', IDE0161: 'warning' } });

		expect(file.content).toContain('# IDE0003: Name can be simplified (editor only)\ndotnet_diagnostic.IDE0003.severity = warning');
		expect(file.content).toContain('# IDE0161: Convert to file-scoped namespace\ndotnet_diagnostic.IDE0161.severity = warning');
	});

	it('writes no rule comments when comments are turned off', () => {
		const file = toRootOutput({ severities: { CA1822: 'warning' } }, 'none');

		expect(file.content).not.toContain('# CA1822');
		expect(file.content).toContain('dotnet_diagnostic.CA1822.severity = warning');
	});

	it('groups options under their catalog group with the rules they feed', () => {
		const file = toRootOutput({ options: { dotnet_style_qualification_for_field: 'true', csharp_style_var_elsewhere: 'true' } });

		expect(file.content).toContain('## this. and Me. qualification (IDE0003, IDE0009)\ndotnet_style_qualification_for_field = true');
		expect(file.content).toContain('## var preferences (IDE0007, IDE0008)\ncsharp_style_var_elsewhere = true');
	});

	it('writes a nested file with only what the scope overrides, and no root line', () => {
		const config = toConfig({ path: '', severities: { CA1707: 'warning', CA1822: 'warning' } }, { path: 'tests', severities: { CA1707: 'none' } });

		const nestedFile = toEditorConfigFiles(config, catalog, { commentStyle: 'idAndTitle' }).files[1];

		expect(nestedFile.path).toBe('tests/.editorconfig');
		expect(nestedFile.content).not.toContain('root = true');
		expect(nestedFile.content).toContain('dotnet_diagnostic.CA1707.severity = none');
		expect(nestedFile.content).not.toContain('CA1822');
	});

	it('writes no file for a scope that overrides nothing in .editorconfig', () => {
		const config = toConfig({ path: '' }, { path: 'src', projectKind: 'library' });

		expect(toEditorConfigFiles(config, catalog, { commentStyle: 'idAndTitle' }).files.map(file => file.path)).toEqual(['.editorconfig']);
	});

	it('shares one naming style between rules that name things the same way', () => {
		const file = toRootOutput({ naming: NAMING_TEMPLATES.filter(rule => rule.symbols === 'types' || rule.symbols === 'members') });

		expect(file.content).toContain('dotnet_naming_rule.types_should_be_pascal_case.style = pascal_case');
		expect(file.content).toContain('dotnet_naming_rule.members_should_be_pascal_case.style = pascal_case');
		expect(file.content.match(/dotnet_naming_style\.pascal_case\.capitalization/g)).toHaveLength(1);
	});
});

describe('version gating', () => {
	it('leaves out a rule the language version is too old for', () => {
		const file = toRootOutput({ tfms: ['net6.0'], severities: { IDE0300: 'warning' } });

		expect(file.skippedKeys).toEqual([{ key: 'IDE0300', reason: 'Needs C# 12.0' }]);
	});

	it('keeps a rule when LangVersion is raised above the target framework default', () => {
		const config: WizardConfig = { versions: { sdkBand: BAND, langVersion: 'latest' }, scopes: [{ path: '', tfms: ['netstandard2.0'], severities: { IDE0300: 'warning' } }] };

		expect(toEditorConfigFiles(config, catalog, { commentStyle: 'idAndTitle' }).skippedKeys).toEqual([]);
	});

	it('leaves out a rule whose APIs one of the target frameworks lacks', () => {
		const file = toRootOutput({ tfms: ['net10.0', 'netstandard2.0'], severities: { CA1510: 'warning' } });

		expect(file.skippedKeys).toEqual([{ key: 'CA1510', reason: 'Needs net6.0 APIs in every target' }]);
	});

	it('checks a scope against its own target frameworks, not the root ones', () => {
		const config = toConfig({ path: '', tfms: ['net10.0'], severities: { IDE0330: 'warning' } }, { path: 'src/Legacy', tfms: ['netstandard2.0'], severities: { IDE0330: 'error' } });

		const output = toEditorConfigFiles(config, catalog, { commentStyle: 'idAndTitle' });

		expect(output.skippedKeys).toEqual([{ scopePath: 'src/Legacy', key: 'IDE0330', reason: 'Needs C# 13.0' }]);
		expect(output.files.map(file => file.path)).toEqual(['.editorconfig']);
	});

	it('leaves out rules an older SDK band does not have', () => {
		const config = toConfig({ path: '', tfms: ['net10.0'], severities: { CA2026: 'warning' } });

		expect(toEditorConfigFiles(config, catalog, { commentStyle: 'idAndTitle' }).skippedKeys).toEqual([{ scopePath: '', key: 'CA2026', reason: 'Not in SDK 10.0.4xx' }]);
	});
});
