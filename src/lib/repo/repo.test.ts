import { describe, expect, it } from 'vitest';
import { readBands, readCatalog } from '../../../scripts/readCatalog.ts';
import { PRESET_LEVELS, toPresetConfig, toPresetName } from '../config/presets.ts';
import { toSavedState } from '../config/shareLink.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import { toPackagesPropsWithVersions } from '../projects/projectCleanup.ts';
import { findUnmanaged, toSavedText } from './preserve.ts';
import { findPinnedBand, toRepoConfig } from './repoImport.ts';

const catalog = readCatalog('10.0.4xx');

const EDITORCONFIG = `root = true

[*]
indent_style = space
max_line_length = 120

[*.cs]
# Rider's own setting
resharper_braces_for_ifelse = required
dotnet_diagnostic.CA1822.severity = error
dotnet_diagnostic.SA1101.severity = none
`;

const BUILD_PROPS = `<Project>
	<PropertyGroup>
		<Nullable>enable</Nullable>
		<LangVersion>preview</LangVersion>
	</PropertyGroup>
	<PropertyGroup Condition="'$(Configuration)' == 'Release'">
		<Optimize>true</Optimize>
	</PropertyGroup>
	<ItemGroup>
		<InternalsVisibleTo Include="$(AssemblyName).Benchmarks" />
	</ItemGroup>
	<Target Name="Stamp" BeforeTargets="Build" />
</Project>
`;

const PACKAGES_PROPS = `<Project>
	<PropertyGroup>
		<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
	</PropertyGroup>
	<ItemGroup>
		<PackageVersion Include="Serilog" Version="4.0.0" />
	</ItemGroup>
</Project>
`;

const files = [
	{ path: 'tests/.editorconfig', text: '[*.cs]\ndotnet_diagnostic.CA1707.severity = none\n' },
	{ path: 'Directory.Packages.props', text: PACKAGES_PROPS },
	{ path: '.editorconfig', text: EDITORCONFIG },
	{ path: 'Directory.Build.props', text: BUILD_PROPS },
	{ path: 'global.json', text: '{ "sdk": { "version": "10.0.401", "rollForward": "latestPatch", "paths": [".dotnet"] } }' },
	{ path: 'src/App/Program.cs', text: 'class Program {}' }
];

describe('loading a repo', () => {
	it('builds folders from the root down whatever order the files come in', () => {
		const { config } = toRepoConfig(files, catalog);

		expect(config.scopes.map(scope => scope.path)).toEqual(['', 'tests']);
		expect(config.scopes[0].severities?.CA1822).toBe('error');
		expect(config.scopes[0].build?.Nullable).toBe('enable');
		expect(config.scopes[1].severities?.CA1707).toBe('none');
		expect(config.globalJson?.rollForward).toBe('latestPatch');
		expect(findPinnedBand(files, readBands())?.band).toBe('10.0.4xx');
	});

	it('lists what it keeps instead of reporting it dropped', () => {
		const { notes } = toRepoConfig(files, catalog);
		const messages = notes.map(note => `${note.fileName}: ${note.message}`);

		expect(messages).toContainEqual(expect.stringMatching(/^\.editorconfig: Kept as is: .*resharper_braces_for_ifelse.*SA1101/));
		expect(messages).toContainEqual(expect.stringMatching(/^Directory\.Build\.props: Kept as is: .*LangVersion.*Optimize.*InternalsVisibleTo.*Target/));
		expect(messages.some(message => message.includes('dropped'))).toBe(false);
	});
});

describe('reopening generated files', () => {
	it('keeps what each folder holds, including folders with nothing else on disk', () => {
		const config = toPresetConfig('recommended', catalog);
		const source = config.scopes.find(scope => scope.path === 'src');
		if (source) source.projectKind = 'service';
		config.scopes.push({ path: 'src/Core', projectKind: 'library' });
		const files = toGeneratedOutput(config, catalog, { commentStyle: 'none', presetName: toPresetName('recommended') }).files.map(file => ({ path: file.path, text: file.content }));

		const reopened = toRepoConfig(files, catalog);

		expect(files.find(file => file.path === '.editorconfig')?.text).toContain('# Projects: src service; tests test; src/Core library');
		expect(Object.fromEntries(reopened.config.scopes.map(scope => [scope.path, scope.projectKind]))).toEqual({ '': undefined, src: 'service', tests: 'test', 'src/Core': 'library' });
	});

	it('keeps every folder at no kind when none sets one', () => {
		const config = toPresetConfig('recommended', catalog);
		for (const scope of config.scopes) delete scope.projectKind;
		const files = toGeneratedOutput(config, catalog, { commentStyle: 'none', presetName: toPresetName('recommended') }).files.map(file => ({ path: file.path, text: file.content }));

		const reopened = toRepoConfig(files, catalog);

		expect(files.find(file => file.path === '.editorconfig')?.text).toContain('# Projects: none');
		expect(reopened.config.scopes.map(scope => scope.projectKind)).not.toContain('test');
	});

	it('reads an older header with a bare preset name as src holding no kind', () => {
		const header = '# Settings for .NET SDK 10.0.4xx, catalog 2026-10-20, preset Recommended\nroot = true\n';

		const reopened = toRepoConfig([{ path: '.editorconfig', text: header }], catalog);

		expect(reopened.config.scopes.find(scope => scope.path === 'src')?.projectKind).toBeUndefined();
		expect(reopened.config.scopes.find(scope => scope.path === 'tests')?.projectKind).toBe('test');
	});

	it("reads an older header such as 'Strict for apps and services' as the Strict preset with src holding apps and services", () => {
		const header = '# Settings for .NET SDK 10.0.4xx, catalog 2026-10-20, preset Strict for apps and services\nroot = true\n';

		const reopened = toRepoConfig([{ path: '.editorconfig', text: header }], catalog);

		expect(reopened.preset).toBe('strict');
		expect(reopened.config.scopes.find(scope => scope.path === 'src')?.projectKind).toBe('service');
	});

	it.each(PRESET_LEVELS.map(preset => ({ name: toPresetName(preset), preset })))('restores $name with nothing changed from it', ({ preset }) => {
		const files = toGeneratedOutput(toPresetConfig(preset, catalog), catalog, { commentStyle: 'idAndTitle', presetName: toPresetName(preset) }).files.map(file => ({
			path: file.path,
			text: file.content
		}));

		const reopened = toRepoConfig(files, catalog);

		expect(reopened.preset).toEqual(preset);
		expect(toSavedState(reopened.config, preset, catalog).changes).toEqual({});
	});
});

describe('packages in a loaded repo', () => {
	it("keeps a folder's inherited packages when its props file only adds one", () => {
		const { config } = toRepoConfig(
			[
				{ path: 'Directory.Packages.props', text: '<Project><ItemGroup><GlobalPackageReference Include="Meziantou.Analyzer" Version="1.0.0" /></ItemGroup></Project>' },
				{ path: 'src/Directory.Packages.props', text: '<Project><ItemGroup><GlobalPackageReference Include="Microsoft.CodeAnalysis.PublicApiAnalyzers" Version="1.0.0" /></ItemGroup></Project>' }
			],
			catalog
		);

		expect(config.scopes.find(scope => scope.path === 'src')?.packages).toEqual(['Meziantou.Analyzer', 'Microsoft.CodeAnalysis.PublicApiAnalyzers']);
	});

	it('selects a framework analyzer whose rules a folder configures, since frameworks bring their own', () => {
		const { config } = toRepoConfig([{ path: 'tests/.editorconfig', text: '[*.cs]\ndotnet_diagnostic.MSTEST0001.severity = warning' }], catalog);

		expect(config.scopes.find(scope => scope.path === 'tests')?.packages).toEqual(['MSTest.Analyzers']);
	});

	it('reads nuget.config in any casing', () => {
		const { config } = toRepoConfig(
			[{ path: 'NuGet.Config', text: '<configuration><packageSources><add key="feed" value="https://example.com/v3/index.json" /></packageSources></configuration>' }],
			catalog
		);

		expect(config.nuget?.sources.map(source => source.key)).toEqual(['feed']);
	});
});

describe('saving over existing files', () => {
	const config = toRepoConfig(files, catalog).config;
	const output = toGeneratedOutput(config, catalog, { commentStyle: 'idAndTitle' });
	const generated = (path: string) => output.files.find(file => file.path === path)?.content ?? '';
	const existing = (path: string) => files.find(file => file.path === path)?.text;

	it.each(['.editorconfig', 'Directory.Build.props', 'Directory.Packages.props', 'global.json'])('keeps what the wizard does not manage in %s, and saving again changes nothing', path => {
		const saved = toSavedText(path, generated(path), existing(path), catalog);

		expect(toSavedText(path, generated(path), saved, catalog)).toBe(saved);
	});

	it('keeps unmanaged settings, properties, items and targets', () => {
		const editorConfig = toSavedText('.editorconfig', generated('.editorconfig'), existing('.editorconfig'), catalog);
		const buildProps = toSavedText('Directory.Build.props', generated('Directory.Build.props'), existing('Directory.Build.props'), catalog);
		const packagesProps = toSavedText('Directory.Packages.props', generated('Directory.Packages.props'), existing('Directory.Packages.props'), catalog);
		const globalJson = JSON.parse(toSavedText('global.json', generated('global.json'), existing('global.json'), catalog));

		expect(editorConfig.match(/max_line_length = 120/g)).toHaveLength(1);
		expect(editorConfig).toContain("# Rider's own setting\nresharper_braces_for_ifelse = required");
		expect(editorConfig).toContain('dotnet_diagnostic.SA1101.severity = none');
		expect(buildProps).toContain('<LangVersion>preview</LangVersion>');
		expect(buildProps).toContain(`<PropertyGroup Condition="'$(Configuration)' == 'Release'">`);
		expect(buildProps).toContain('<InternalsVisibleTo Include="$(AssemblyName).Benchmarks" />');
		expect(buildProps).toContain('<Target Name="Stamp" BeforeTargets="Build" />');
		expect(buildProps.match(/<Nullable>/g)).toHaveLength(1);
		expect(packagesProps).toContain('<PackageVersion Include="Serilog" Version="4.0.0" />');
		expect(globalJson.sdk).toEqual({ version: catalog.band.sdkVersion, rollForward: 'latestPatch', allowPrerelease: false, paths: ['.dotnet'] });
	});

	it('leaves unmanaged settings beside the line they followed instead of moving them into a block of their own', () => {
		const editorConfig = toSavedText('.editorconfig', generated('.editorconfig'), existing('.editorconfig'), catalog);
		const buildProps = toSavedText('Directory.Build.props', generated('Directory.Build.props'), existing('Directory.Build.props'), catalog);

		expect(editorConfig).toContain("[*.cs]\n# Rider's own setting\nresharper_braces_for_ifelse = required\n");
		expect(buildProps).toMatch(/<Nullable>enable<\/Nullable>\n\t\t<LangVersion>preview<\/LangVersion>\n\t<\/PropertyGroup>/);
		expect(buildProps.indexOf('<Optimize>')).toBeLessThan(buildProps.indexOf('Benchmarks'));
		expect(buildProps.indexOf('Benchmarks')).toBeLessThan(buildProps.indexOf('<Target Name="Stamp"'));
		expect(buildProps).not.toContain('Kept');
	});

	it('keeps an unmanaged property in its CI-only group when the generated file also writes its neighbor unconditionally', () => {
		const generatedProps = `<Project>
	<PropertyGroup Label="Warnings">
		<TreatWarningsAsErrors>true</TreatWarningsAsErrors>
	</PropertyGroup>
</Project>
`;
		const existingProps = `<Project>
	<PropertyGroup Condition="'$(CI)' == 'true'">
		<TreatWarningsAsErrors>true</TreatWarningsAsErrors>
		<PublishReadyToRun>true</PublishReadyToRun>
	</PropertyGroup>
</Project>
`;

		const saved = toSavedText('Directory.Build.props', generatedProps, existingProps, catalog);

		expect(saved).toMatch(/<PropertyGroup Condition="'\$\(CI\)' == 'true'">\n\t\t<PublishReadyToRun>true<\/PublishReadyToRun>\n\t<\/PropertyGroup>/);
		expect(saved).toMatch(/<TreatWarningsAsErrors>true<\/TreatWarningsAsErrors>\n\t<\/PropertyGroup>/);
	});

	it('saves the project under test groups over themselves unchanged and keeps hand-written project references', () => {
		const opinionated = toPresetConfig('opinionated', catalog);
		const testsProps = toGeneratedOutput(opinionated, catalog, { commentStyle: 'none' }).files.find(file => file.path === 'tests/Directory.Build.props')?.content ?? '';
		const withSharedReference = testsProps.replace('</Project>', '\t<ItemGroup>\n\t\t<ProjectReference Include="../shared/TestKit.csproj" />\n\t</ItemGroup>\n</Project>');

		expect(testsProps).toContain('<ProjectReference Include="$(ProjectUnderTestPath)"');
		expect(toSavedText('tests/Directory.Build.props', testsProps, testsProps, catalog)).toBe(testsProps);
		expect(toSavedText('tests/Directory.Build.props', testsProps, withSharedReference, catalog)).toContain('<ProjectReference Include="../shared/TestKit.csproj" />');
		expect(findUnmanaged('tests/Directory.Build.props', testsProps, catalog)).toEqual([]);
	});

	it('keeps package versions moved out of project files when it saves Directory.Packages.props again', () => {
		const opinionated = toPresetConfig('opinionated', catalog);
		const packagesProps = toGeneratedOutput(opinionated, catalog, { commentStyle: 'none' }).files.find(file => file.path === 'Directory.Packages.props')?.content ?? '';
		const withVersions = toPackagesPropsWithVersions(packagesProps, [{ packageId: 'Serilog', version: '4.0.0' }]);

		expect(toSavedText('Directory.Packages.props', packagesProps, withVersions, catalog)).toBe(withVersions);
	});

	it('adds comments only above settings it adds or changes, and keeps its headings', () => {
		const existingProps = '<Project>\n\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t\t<Deterministic>false</Deterministic>\n\t</PropertyGroup>\n</Project>\n';
		const generatedProps =
			'<Project>\n\t<PropertyGroup Label="Language">\n\t\t<!-- Nullable reference types. -->\n\t\t<Nullable>enable</Nullable>\n\t\t<!-- Global usings for common namespaces. -->\n\t\t<ImplicitUsings>enable</ImplicitUsings>\n\t</PropertyGroup>\n\t<PropertyGroup Label="Reproducible builds">\n\t\t<!-- The same inputs always produce the same binary. -->\n\t\t<Deterministic>true</Deterministic>\n\t</PropertyGroup>\n</Project>\n';
		const existingEditorConfig = 'root = true\n\n[*.cs]\ndotnet_diagnostic.CA1822.severity = warning\n';
		const generatedEditorConfig =
			'# Settings for .NET SDK 10.0.4xx, catalog 2026-10-20, preset Recommended\nroot = true\n\n#### C# files ####\n[*.cs]\n## Performance\n# CA1822: Mark members as static\ndotnet_diagnostic.CA1822.severity = warning\n# CA1825: Avoid zero-length array allocations\ndotnet_diagnostic.CA1825.severity = warning\n';

		const props = toSavedText('Directory.Build.props', generatedProps, existingProps, catalog);
		const editorConfig = toSavedText('.editorconfig', generatedEditorConfig, existingEditorConfig, catalog);

		expect(props).not.toContain('Nullable reference types');
		expect(props).toContain('<!-- Global usings for common namespaces. -->');
		expect(props).toContain('<!-- The same inputs always produce the same binary. -->');
		expect(editorConfig).toBe(
			'# Settings for .NET SDK 10.0.4xx, catalog 2026-10-20, preset Recommended\nroot = true\n\n#### C# files ####\n[*.cs]\n## Performance\ndotnet_diagnostic.CA1822.severity = warning\n# CA1825: Avoid zero-length array allocations\ndotnet_diagnostic.CA1825.severity = warning\n'
		);
	});

	it('replaces comments the file has with the current comment style', () => {
		const existing = '[*.cs]\n# CA1822\ndotnet_diagnostic.CA1822.severity = warning\n';
		const generated = '[*.cs]\n# CA1822: Mark members as static\ndotnet_diagnostic.CA1822.severity = warning\n';

		expect(toSavedText('.editorconfig', generated, existing, catalog)).toBe(generated);
	});

	it('adds its comment above a property that moves out of the CI-only group', () => {
		const existing = `<Project>\n\t<PropertyGroup Condition="'$(CI)' == 'true'">\n\t\t<TreatWarningsAsErrors>true</TreatWarningsAsErrors>\n\t</PropertyGroup>\n</Project>\n`;
		const generated = '<Project>\n\t<PropertyGroup>\n\t\t<!-- Fails the build on any warning. -->\n\t\t<TreatWarningsAsErrors>true</TreatWarningsAsErrors>\n\t</PropertyGroup>\n</Project>\n';

		expect(toSavedText('Directory.Build.props', generated, existing, catalog)).toContain('<!-- Fails the build on any warning. -->');
	});

	it('replaces the project name prefix group rather than keeping the old one beside it', () => {
		const prefixed = toRepoConfig([{ path: 'Directory.Build.props', text: BUILD_PROPS }], catalog).config;
		prefixed.projectNamePrefix = 'Contoso';
		const first = toGeneratedOutput(prefixed, catalog, { commentStyle: 'none' }).files.find(file => file.path === 'Directory.Build.props')?.content ?? '';
		prefixed.projectNamePrefix = 'Fabrikam';
		const second = toGeneratedOutput(prefixed, catalog, { commentStyle: 'none' }).files.find(file => file.path === 'Directory.Build.props')?.content ?? '';

		const saved = toSavedText('Directory.Build.props', second, toSavedText('Directory.Build.props', first, BUILD_PROPS, catalog), catalog);

		expect(saved).toContain(`<PropertyGroup Label="Project names" Condition="'$(MSBuildProjectName)' != 'Fabrikam' and !$(MSBuildProjectName.StartsWith('Fabrikam.'))">`);
		expect(saved).not.toContain('Contoso');
		expect(toRepoConfig([{ path: 'Directory.Build.props', text: saved }], catalog).config.projectNamePrefix).toBe('Fabrikam');
	});
});
