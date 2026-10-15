import { describe, expect, it } from 'vitest';
import { readBands, readCatalog } from '../../../scripts/readCatalog.ts';
import { ALL_PRESETS, toPresetConfig, toPresetName } from '../config/presets.ts';
import { toSavedState } from '../config/shareLink.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import { toSavedText } from './preserve.ts';
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
		<InternalsVisibleTo Include="$(AssemblyName).Tests" />
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
	it.each(ALL_PRESETS.map(preset => ({ name: toPresetName(preset), preset })))('restores $name with nothing changed from it', ({ preset }) => {
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
		expect(buildProps).toContain('<InternalsVisibleTo Include="$(AssemblyName).Tests" />');
		expect(buildProps).toContain('<Target Name="Stamp" BeforeTargets="Build" />');
		expect(buildProps.match(/<Nullable>/g)).toHaveLength(1);
		expect(packagesProps).toContain('<PackageVersion Include="Serilog" Version="4.0.0" />');
		expect(globalJson.sdk).toEqual({ version: catalog.band.sdkVersion, rollForward: 'latestPatch', allowPrerelease: false, paths: ['.dotnet'] });
	});
});
