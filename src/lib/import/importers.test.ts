import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { toPresetConfig } from '../config/presets.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import { findRulesAddedSince } from '../export/whatsNew.ts';
import { importEditorConfig } from './editorConfigImport.ts';
import { importFile } from './importFile.ts';
import { mergeImport } from './mergeImport.ts';
import { importMsBuildFile } from './msbuildImport.ts';
import { importRuleSet } from './rulesetImport.ts';

const catalog = readCatalog('10.0.4xx');

describe('importEditorConfig', () => {
	it('reads formatting, options, severities, categories and naming rules', () => {
		const result = importEditorConfig(
			[
				'root = true',
				'[*]',
				'indent_style = tab',
				'[*.cs]',
				'csharp_style_namespace_declarations = file_scoped',
				'dotnet_diagnostic.CA1822.severity = warning',
				'dotnet_analyzer_diagnostic.category-Security.severity = error',
				'dotnet_naming_rule.interfaces_rule.severity = warning',
				'dotnet_naming_rule.interfaces_rule.symbols = interfaces',
				'dotnet_naming_rule.interfaces_rule.style = prefix_i',
				'dotnet_naming_symbols.interfaces.applicable_kinds = interface',
				'dotnet_naming_style.prefix_i.capitalization = pascal_case',
				'dotnet_naming_style.prefix_i.required_prefix = I'
			].join('\n'),
			catalog
		);

		expect(result.settings).toEqual({
			formatting: { '[*]': { indent_style: 'tab' } },
			options: { csharp_style_namespace_declarations: 'file_scoped' },
			severities: { CA1822: 'warning' },
			categorySeverities: { Security: 'error' },
			naming: [
				{
					symbols: 'interfaces',
					applicableKinds: ['interface'],
					applicableAccessibilities: ['*'],
					requiredModifiers: [],
					capitalization: 'pascal_case',
					requiredPrefix: 'I',
					requiredSuffix: '',
					wordSeparator: '',
					severity: 'warning'
				}
			]
		});
		expect(result.notes).toEqual([]);
	});

	it('turns a legacy severity suffix into the option rule severity', () => {
		const result = importEditorConfig('[*.cs]\ndotnet_style_readonly_field = true:warning\ncsharp_style_namespace_declarations = file_scoped:warning', catalog);

		expect(result.settings.options).toEqual({ dotnet_style_readonly_field: 'true', csharp_style_namespace_declarations: 'file_scoped' });
		expect(result.settings.severities).toEqual({ IDE0044: 'warning' });
		expect(result.notes.map(note => note.message)).toEqual(['csharp_style_namespace_declarations had a legacy :warning suffix, but it feeds 2 rules, so set their severities on the Code style step.']);
	});

	it('drops trailing comments and unmaintained analyzer rules with notes', () => {
		const result = importEditorConfig('[*.cs]\ndotnet_diagnostic.CA1822.severity = warning # static\ndotnet_diagnostic.SA1101.severity = none\nroslynator_accessibility_modifiers = explicit', catalog);

		expect(result.settings.severities).toEqual({ CA1822: 'warning' });
		expect(result.notes.map(note => note.message)).toEqual([
			'StyleCop.Analyzers is no longer maintained and predates C# 12, so its 1 rule settings were dropped. The Analyzers step shows maintained alternatives.',
			"roslynator_accessibility_modifiers aren't settings the wizard supports, so they were dropped.",
			"Dropped 1 trailing comments. EditorConfig doesn't support inline comments, so they were part of the values."
		]);
	});

	it('reads the catalog version from a generated header', () => {
		expect(importEditorConfig('# Settings for .NET SDK 10.0.4xx, catalog 2026-01-02\nroot = true', catalog).catalogVersion).toBe('2026-01-02');
	});

	it('reads a global AnalyzerConfig, which has no sections', () => {
		expect(importFile('Analyzers.globalconfig', 'is_global = true\nglobal_level = 100\ndotnet_diagnostic.CA1822.severity = error', catalog)?.settings.severities).toEqual({ CA1822: 'error' });
	});

	it('reads generated_code as an ignored folder, and writes it back', () => {
		const result = importEditorConfig('[*.cs]\ngenerated_code = true', catalog);
		const editorConfig = toGeneratedOutput({ versions: { sdkBand: '10.0.4xx' }, scopes: [{ path: '' }, { path: 'legacy', ...result.settings }] }, catalog, { commentStyle: 'none' }).files.find(
			file => file.path === 'legacy/.editorconfig'
		)?.content;

		expect(result.settings.isIgnored).toBe(true);
		expect(result.notes).toEqual([]);
		expect(editorConfig).toContain('[*.cs]\ngenerated_code = true');
	});

	it("reads rule IDs and severities in any case, and reports a severity it can't read", () => {
		const result = importEditorConfig('[*.cs]\ndotnet_diagnostic.ca1822.severity = Warning\ndotnet_diagnostic.CA2007.severity = loud', catalog);

		expect(result.settings.severities).toEqual({ CA1822: 'warning' });
		expect(result.notes.some(note => note.message.includes('dotnet_diagnostic.CA2007.severity'))).toBe(true);
	});
});

describe('importMsBuildFile', () => {
	it('reads properties, CI-only groups, suppressions, frameworks and analyzer packages', () => {
		const result = importMsBuildFile(
			`<Project>
				<PropertyGroup>
					<TargetFrameworks>net10.0;net48</TargetFrameworks>
					<Nullable>enable</Nullable>
					<NoWarn>$(NoWarn);1591;CA1707</NoWarn>
					<LangVersion>latest</LangVersion>
					<WarningsAsErrors>$(WarningsAsErrors);nullable</WarningsAsErrors>
				</PropertyGroup>
				<PropertyGroup Condition="'$(GITHUB_ACTIONS)' == 'true'">
					<TreatWarningsAsErrors>true</TreatWarningsAsErrors>
				</PropertyGroup>
				<PropertyGroup Condition="'$(Configuration)' == 'Release'">
					<Optimize>true</Optimize>
				</PropertyGroup>
				<ItemGroup>
					<PackageReference Include="Meziantou.Analyzer" Version="2.0.0" PrivateAssets="all" />
					<PackageReference Include="StyleCop.Analyzers" Version="1.1.118" />
				</ItemGroup>
			</Project>`,
			catalog
		);

		expect(result.settings).toEqual({
			tfms: ['net10.0'],
			isTargetFrameworkShared: true,
			build: { Nullable: 'enable', WarningsAsErrors: 'nullable' },
			severities: { CS1591: 'none', CA1707: 'none' },
			ciBuild: { TreatWarningsAsErrors: 'true' },
			packages: ['Meziantou.Analyzer']
		});
		expect(result.notes.map(note => note.severity)).toEqual(['info', 'warning', 'info', 'info', 'warning', 'info']);
	});

	it('reads a single TargetFramework in shared props as set for every project', () => {
		const result = importMsBuildFile('<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>', catalog);

		expect(result.settings).toEqual({ tfms: ['net10.0'], isTargetFrameworkShared: true });
	});

	it('reads the project under test reference as on and its removal as off, without reporting its properties as dropped', () => {
		const included = importMsBuildFile(
			`<Project><PropertyGroup><ProjectUnderTest>$([System.Text.RegularExpressions.Regex]::Replace($(MSBuildProjectName), '\\.Tests$', ''))</ProjectUnderTest><ProjectUnderTestPath>$(MSBuildThisFileDirectory)../src/$(ProjectUnderTest)/$(ProjectUnderTest).csproj</ProjectUnderTestPath></PropertyGroup><ItemGroup><ProjectReference Include="$(ProjectUnderTestPath)" Condition="Exists('$(ProjectUnderTestPath)')" /></ItemGroup></Project>`,
			catalog
		);
		const removed = importMsBuildFile('<Project><ItemGroup><ProjectReference Remove="$(ProjectUnderTestPath)" /></ItemGroup></Project>', catalog);

		expect(included.settings).toEqual({ isProjectUnderTestReferenced: true });
		expect(included.notes).toEqual([]);
		expect(removed.settings).toEqual({ isProjectUnderTestReferenced: false });
	});

	it('reads the .Tests InternalsVisibleTo item as letting tests see internals, and its removal as hiding them', () => {
		const included = importMsBuildFile('<Project><ItemGroup><InternalsVisibleTo Include="$(AssemblyName).Tests" /></ItemGroup></Project>', catalog);
		const removed = importMsBuildFile('<Project><ItemGroup><InternalsVisibleTo Remove="$(AssemblyName).Tests" /></ItemGroup></Project>', catalog);

		expect(included.settings).toEqual({ areInternalsVisibleToTests: true });
		expect(removed.settings).toEqual({ areInternalsVisibleToTests: false });
	});

	it('skips a property with its own condition unless the condition limits it to CI', () => {
		const result = importMsBuildFile(
			`<Project><PropertyGroup>
				<TreatWarningsAsErrors Condition="'$(CI)' == 'true'">true</TreatWarningsAsErrors>
				<Optimize Condition="'$(Configuration)' == 'Release'">true</Optimize>
			</PropertyGroup></Project>`,
			catalog
		);

		expect(result.settings).toEqual({ ciBuild: { TreatWarningsAsErrors: 'true' } });
	});

	it('keeps NuGet warnings in NoWarn, since .editorconfig cannot suppress them', () => {
		const result = importMsBuildFile('<Project><PropertyGroup><NoWarn>$(NoWarn);NU1603;CA1707</NoWarn></PropertyGroup></Project>', catalog);

		expect(result.settings.severities).toEqual({ CA1707: 'none' });
		expect(result.notes).toContainEqual(expect.objectContaining({ isDropped: true, message: expect.stringContaining('NU1603') }));
	});

	it('flags deprecated package properties as errors', () => {
		const result = importMsBuildFile('<Project><PropertyGroup><PackageLicenseUrl>https://example.com</PackageLicenseUrl></PropertyGroup></Project>', catalog);

		expect(result.notes).toEqual([{ severity: 'error', message: 'PackageLicenseUrl was dropped: it is deprecated; use PackageLicenseExpression.' }]);
	});
});

it('converts a rule set into severities', () => {
	const result = importRuleSet('<RuleSet><Rules AnalyzerId="x"><Rule Id="CA1822" Action="Warning" /><Rule Id="CA2007" Action="None" /><Rule Id="SA1101" Action="Error" /></Rules></RuleSet>', catalog);

	expect(result.settings.severities).toEqual({ CA1822: 'warning', CA2007: 'none' });
});

it('round-trips a generated config through the importers unchanged', () => {
	const original = toPresetConfig({ level: 'recommended', kind: 'any' }, catalog);
	const files = toGeneratedOutput(original, catalog, { commentStyle: 'idAndTitle' }).files;
	const rootFiles = ['.editorconfig', 'Directory.Build.props', 'Directory.Packages.props'];
	const imported: WizardConfig = { versions: original.versions, scopes: [{ path: '', tfms: original.scopes[0].tfms }] };
	for (const path of rootFiles) {
		const result = importFile(path, files.find(file => file.path === path)?.content ?? '', catalog);
		if (result) mergeImport(imported, imported.scopes[0], result);
	}
	imported.scopes[0].bannedApis = original.scopes[0].bannedApis;

	const regenerated = toGeneratedOutput(imported, catalog, { commentStyle: 'idAndTitle' }).files;

	for (const path of rootFiles) expect(regenerated.find(file => file.path === path)?.content, path).toBe(files.find(file => file.path === path)?.content);
});

it('lists rules added to the catalog after a config was made', () => {
	const history = new Map(catalog.history);
	history.set('CA1873', '2027-01-15');
	const laterCatalog = { ...catalog, history };

	const newRules = findRulesAddedSince(laterCatalog, '2026-10-12', { csharpVersion: '14.0', tfms: ['net10.0'], packages: [] });

	expect(newRules.map(rule => rule.id)).toEqual(['CA1873']);
});
