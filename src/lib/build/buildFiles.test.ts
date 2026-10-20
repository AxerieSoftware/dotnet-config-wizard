import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import { toGitAttributes } from '../formatting/gitattributes.ts';
import { toNuGetConfig } from '../packages/nugetConfig.ts';
import { toGlobalJson } from '../sdk/globalJson.ts';
import { toBuildFiles } from './buildPropsFiles.ts';

const catalog = readCatalog('10.0.4xx');

function toConfig(...scopes: ScopeConfig[]): WizardConfig {
	return { versions: { sdkBand: '10.0.4xx' }, scopes };
}

function fileContent(config: WizardConfig, path: string): string | undefined {
	return toBuildFiles(config, catalog, 'none').files.find(file => file.path === path)?.content;
}

describe('Directory.Build.props', () => {
	it('groups properties under labeled property groups', () => {
		const content = fileContent(toConfig({ path: '', build: { Nullable: 'enable', Deterministic: 'true' } }), 'Directory.Build.props');

		expect(content).toContain('<PropertyGroup Label="Language">\n\t\t<Nullable>enable</Nullable>\n\t</PropertyGroup>');
		expect(content).toContain('<PropertyGroup Label="Reproducible builds">\n\t\t<Deterministic>true</Deterministic>');
	});

	it('appends list properties to what they inherit', () => {
		const content = fileContent(toConfig({ path: '', build: { WarningsAsErrors: 'nullable' } }), 'Directory.Build.props');

		expect(content).toContain('<WarningsAsErrors>$(WarningsAsErrors);nullable</WarningsAsErrors>');
	});

	it('limits CI-only properties to builds where CI or TF_BUILD is set', () => {
		const content = fileContent(toConfig({ path: '', ciBuild: { TreatWarningsAsErrors: 'true' } }), 'Directory.Build.props');

		expect(content).toContain(`<PropertyGroup Label="Continuous integration" Condition="'$(CI)' == 'true' or '$(TF_BUILD)' == 'true'">`);
		expect(content).toContain(`<PropertyGroup Label="CI builds only" Condition="'$(ContinuousIntegrationBuild)' == 'true'">\n\t\t<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`);
	});

	it('writes a nested file that imports its parent and holds only its own properties', () => {
		const content = fileContent(toConfig({ path: '', build: { Nullable: 'enable' } }, { path: 'tests', build: { IsPackable: 'false' } }), 'tests/Directory.Build.props');

		expect(content).toContain(`<Import Project="$([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '$(MSBuildThisFileDirectory)../'))" />`);
		expect(content).toContain('<IsPackable>false</IsPackable>');
		expect(content).not.toContain('Nullable');
	});

	it('writes no file for a scope that sets nothing', () => {
		expect(fileContent(toConfig({ path: '' }), 'Directory.Build.props')).toBeUndefined();
	});

	it('reports properties the wizard does not know instead of writing them', () => {
		const output = toBuildFiles(toConfig({ path: '', build: { LangVersion: 'latest' } }), catalog, 'none');

		expect(output.skippedKeys).toEqual([{ scopePath: '', key: 'LangVersion', reason: 'Not an MSBuild property the wizard knows' }]);
	});
});

describe('shared TargetFramework', () => {
	it('sets TargetFramework for every project in a folder with one framework', () => {
		expect(fileContent(toConfig({ path: '', tfms: ['net10.0'], isTargetFrameworkShared: true }), 'Directory.Build.props')).toContain('<TargetFramework>net10.0</TargetFramework>');
	});

	it('overrides it in a folder with its own framework, and clears it in a folder that turns it off', () => {
		const config = toConfig({ path: '', tfms: ['net10.0'], isTargetFrameworkShared: true }, { path: 'tools', tfms: ['net11.0'] }, { path: 'tests', isTargetFrameworkShared: false });

		expect(fileContent(config, 'tools/Directory.Build.props')).toContain('<TargetFramework>net11.0</TargetFramework>');
		expect(fileContent(config, 'tests/Directory.Build.props')).toContain('<TargetFramework></TargetFramework>');
	});

	it('sets TargetFrameworks for a folder with several frameworks', () => {
		expect(fileContent(toConfig({ path: '', tfms: ['net11.0', 'net10.0'], isTargetFrameworkShared: true }), 'Directory.Build.props')).toContain('<TargetFrameworks>net10.0;net11.0</TargetFrameworks>');
	});

	it('clears an inherited single TargetFramework in a folder that multi-targets, so its builds still multi-target', () => {
		const content = fileContent(toConfig({ path: '', tfms: ['net10.0'], isTargetFrameworkShared: true }, { path: 'src', tfms: ['net10.0', 'net11.0'] }), 'src/Directory.Build.props');

		expect(content).toContain('<TargetFramework></TargetFramework>');
		expect(content).toContain('<TargetFrameworks>net10.0;net11.0</TargetFrameworks>');
	});
});

describe('project under test', () => {
	it('points each folder at src from its own depth, and removes the inherited reference where a folder turns it off', () => {
		const config = toConfig(
			{ path: '' },
			{ path: 'tests', isProjectUnderTestReferenced: true },
			{ path: 'tests/legacy', isProjectUnderTestReferenced: false },
			{ path: 'tests/legacy/modern', isProjectUnderTestReferenced: true }
		);

		expect(fileContent(config, 'tests/Directory.Build.props')).toContain(
			'<ProjectUnderTestPath>$(MSBuildThisFileDirectory)../src/$(ProjectUnderTest)/$(ProjectUnderTest).csproj</ProjectUnderTestPath>'
		);
		expect(fileContent(config, 'tests/Directory.Build.props')).toContain(`<ProjectReference Include="$(ProjectUnderTestPath)" Condition="Exists('$(ProjectUnderTestPath)')" />`);
		expect(fileContent(config, 'tests/legacy/Directory.Build.props')).toContain('<ProjectReference Remove="$(ProjectUnderTestPath)" />');
		expect(fileContent(config, 'tests/legacy/Directory.Build.props')).not.toContain('<ProjectUnderTestPath>');
		expect(fileContent(config, 'tests/legacy/modern/Directory.Build.props')).toContain('$(MSBuildThisFileDirectory)../../../src/$(ProjectUnderTest)');
	});

	it('writes nothing for a folder that only repeats what it inherits', () => {
		const config = toConfig({ path: '' }, { path: 'tests', isProjectUnderTestReferenced: true }, { path: 'tests/unit', isProjectUnderTestReferenced: true });

		expect(fileContent(config, 'tests/unit/Directory.Build.props')).toBeUndefined();
	});
});

describe('analyzer packages', () => {
	it('uses GlobalPackageReference under central package management', () => {
		const content = fileContent(toConfig({ path: '', build: { ManagePackageVersionsCentrally: 'true' }, packages: ['Meziantou.Analyzer'] }), 'Directory.Packages.props');

		expect(content).toContain(`<GlobalPackageReference Include="Meziantou.Analyzer" Version="${catalog.packages.get('Meziantou.Analyzer')?.version}" />`);
	});

	it('uses a private PackageReference without central package management', () => {
		const content = fileContent(toConfig({ path: '', packages: ['Meziantou.Analyzer'] }), 'Directory.Build.props');

		expect(content).toContain(`<PackageReference Include="Meziantou.Analyzer" Version="${catalog.packages.get('Meziantou.Analyzer')?.version}" PrivateAssets="all" />`);
	});

	it('removes and adds packages in a nested scope relative to its parent', () => {
		const config = toConfig(
			{ path: '', build: { ManagePackageVersionsCentrally: 'true' }, packages: ['Meziantou.Analyzer', 'SonarAnalyzer.CSharp'] },
			{ path: 'tests', packages: ['Meziantou.Analyzer', 'Roslynator.Analyzers'] }
		);

		const content = fileContent(config, 'tests/Directory.Packages.props');

		expect(content).toContain('<GlobalPackageReference Remove="SonarAnalyzer.CSharp" />');
		expect(content).toContain('<GlobalPackageReference Include="Roslynator.Analyzers"');
		expect(content).not.toContain('Include="Meziantou.Analyzer"');
	});

	it('never references analyzers that come with another package', () => {
		const config = toConfig({ path: '', build: { ManagePackageVersionsCentrally: 'true' } }, { path: 'tests', packages: ['xunit.analyzers', 'MSTest.Analyzers'] });

		expect(toBuildFiles(config, catalog, 'none').files.map(file => file.path)).not.toContain('tests/Directory.Packages.props');
	});
});

it("writes a folder's BannedSymbols.txt when it inherits the banned API analyzer", () => {
	const config = toConfig({ path: '', packages: ['Microsoft.CodeAnalysis.BannedApiAnalyzers'] }, { path: 'src', bannedApis: [{ symbol: 'T:System.Console', message: 'Use ILogger.' }] });

	expect(toGeneratedOutput(config, catalog, { commentStyle: 'none' }).files.map(file => file.path)).toContain('src/BannedSymbols.txt');
});

describe('repo-level files', () => {
	it('matches .gitattributes line endings to the formatting sections', () => {
		const gitAttributes = toGitAttributes({ path: '', formatting: { '[*]': { end_of_line: 'lf' }, '[*.{cmd,bat}]': { end_of_line: 'crlf' }, '[*.md]': { end_of_line: 'lf' } } });

		expect(gitAttributes).toBe('* text=auto eol=lf\n*.cmd text eol=crlf\n*.bat text eol=crlf\n');
	});

	it('writes no .gitattributes when no line ending is set', () => {
		expect(toGitAttributes({ path: '', formatting: { '[*]': { indent_style: 'tab' } } })).toBeUndefined();
	});

	it('allows prereleases in global.json only for a preview band', () => {
		const globalJsonConfig = { rollForward: 'latestFeature' as const, isTestingPlatformRunner: false, msbuildSdks: {} };

		expect(JSON.parse(toGlobalJson(globalJsonConfig, readCatalog('11.0.1xx').band)).sdk.allowPrerelease).toBe(true);
		expect(JSON.parse(toGlobalJson(globalJsonConfig, catalog.band)).sdk).toEqual({ version: catalog.band.sdkVersion, rollForward: 'latestFeature', allowPrerelease: false });
	});

	it('clears inherited NuGet sources and maps each package pattern to one source', () => {
		const nugetConfig = toNuGetConfig({
			sources: [
				{ key: 'nuget.org', url: 'https://api.nuget.org/v3/index.json', patterns: ['*'] },
				{ key: 'contoso', url: 'https://pkgs.contoso.com/index.json', patterns: ['Contoso.*'] }
			],
			auditSourceUrl: 'https://api.nuget.org/v3/index.json'
		});

		expect(nugetConfig).toContain('<packageSources>\n\t\t<clear />');
		expect(nugetConfig).toContain('<packageSource key="contoso">\n\t\t\t<package pattern="Contoso.*" />');
		expect(nugetConfig).toContain('<auditSources>\n\t\t<clear />\n\t\t<add key="audit" value="https://api.nuget.org/v3/index.json" />');
	});

	it('moves root severities to Analyzers.globalconfig and wires it into the props', () => {
		const config: WizardConfig = { ...toConfig({ path: '', severities: { CA1822: 'warning' } }), severityFile: 'globalconfig' };

		const output = toGeneratedOutput(config, catalog, { commentStyle: 'none' });

		expect(output.files.find(file => file.path === 'Analyzers.globalconfig')?.content).toBe(
			'is_global = true\nglobal_level = 100\n\n## .NET analyzers: Performance\ndotnet_diagnostic.CA1822.severity = warning\n'
		);
		expect(output.files.find(file => file.path === '.editorconfig')?.content).not.toContain('CA1822');
		expect(output.files.find(file => file.path === 'Directory.Build.props')?.content).toContain('<GlobalAnalyzerConfigFiles Include="$(MSBuildThisFileDirectory)Analyzers.globalconfig" />');
	});
});
