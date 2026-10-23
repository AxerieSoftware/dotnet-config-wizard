import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import { type DiskConfig, findProjectCleanup, toCleanedProjects, toPackagesPropsWithVersions } from './projectCleanup.ts';

const catalog = readCatalog('10.0.4xx');
const NO_DISK_CONFIG: DiskConfig = { packagesPropsText: undefined, readText: () => undefined };

const CONFIG: WizardConfig = {
	versions: { sdkBand: '10.0.4xx' },
	projectNamePrefix: 'Contoso',
	scopes: [
		{
			path: '',
			tfms: ['net10.0'],
			isTargetFrameworkShared: true,
			build: { Nullable: 'enable', ManagePackageVersionsCentrally: 'true' },
			packages: ['Meziantou.Analyzer']
		},
		{ path: 'tests', projectKind: 'test', isProjectUnderTestReferenced: true }
	]
};

const BILLING = `<Project Sdk="Microsoft.NET.Sdk">

	<PropertyGroup>
		<TargetFramework>net10.0</TargetFramework>
		<Nullable>enable</Nullable>
		<LangVersion>14</LangVersion>
		<AssemblyName>Contoso.Billing</AssemblyName>
		<OutputType>Library</OutputType>
	</PropertyGroup>

	<PropertyGroup Condition="'$(Configuration)' == 'Release'">
		<Nullable>enable</Nullable>
	</PropertyGroup>

	<ItemGroup>
		<PackageReference Include="Meziantou.Analyzer" PrivateAssets="all" />
		<PackageReference Include="Serilog" Version="4.0.0" />
	</ItemGroup>
</Project>
`;

const BILLING_TESTS = `<Project Sdk="Microsoft.NET.Sdk">
	<PropertyGroup>
		<LangVersion>preview</LangVersion>
	</PropertyGroup>

	<ItemGroup>
		<PackageReference Include="Serilog" Version="4.0.0" />
		<PackageReference Include="Polly" Version="8.0.0" />
		<ProjectReference Include="..\\..\\src\\Billing\\Billing.csproj" />
		<ProjectReference Include="..\\Shared\\TestKit.csproj" />
	</ItemGroup>
</Project>
`;

const OTHER = `<Project Sdk="Microsoft.NET.Sdk">
	<ItemGroup>
		<PackageReference Include="Polly" Version="8.1.0" />
	</ItemGroup>
</Project>
`;

const PROJECTS = [
	{ path: 'src/Billing/Billing.csproj', text: BILLING },
	{ path: 'tests/Billing.Tests/Billing.Tests.csproj', text: BILLING_TESTS },
	{ path: 'src/Other/Other.csproj', text: OTHER }
];

describe('findProjectCleanup', () => {
	it("offers to remove lines the generated files make unnecessary, and leaves anything a conditional group also sets or that is the project's own", () => {
		const cleanup = findProjectCleanup(CONFIG, catalog, PROJECTS, NO_DISK_CONFIG);

		expect(cleanup.edits.filter(edit => edit.projectPath === 'src/Billing/Billing.csproj').map(edit => edit.line)).toEqual([
			'<TargetFramework>net10.0</TargetFramework>',
			'<LangVersion>14</LangVersion>',
			'<AssemblyName>Contoso.Billing</AssemblyName>',
			'<PackageReference Include="Meziantou.Analyzer" PrivateAssets="all" />',
			'<PackageReference Include="Serilog" Version="4.0.0" />'
		]);
		expect(cleanup.edits.filter(edit => edit.projectPath === 'tests/Billing.Tests/Billing.Tests.csproj').map(edit => edit.line)).toEqual([
			'<ProjectReference Include="..\\..\\src\\Billing\\Billing.csproj" />',
			'<PackageReference Include="Serilog" Version="4.0.0" />'
		]);
	});

	it('keeps a LangVersion that asks for more than the framework default, and versions projects disagree on', () => {
		const cleanup = findProjectCleanup(CONFIG, catalog, PROJECTS, NO_DISK_CONFIG);

		expect(cleanup.keptLines.map(kept => kept.line)).toEqual([
			'<LangVersion>preview</LangVersion>',
			'<PackageReference Include="Polly" Version="8.0.0" />',
			'<PackageReference Include="Polly" Version="8.1.0" />'
		]);
	});

	it('keeps a version that clashes with Directory.Packages.props, and drops one that matches it without moving it again', () => {
		const packagesProps = '<Project>\n\t<ItemGroup>\n\t\t<PackageVersion Include="Serilog" Version="3.1.0" />\n\t\t<PackageVersion Include="Polly" Version="8.0.0" />\n\t</ItemGroup>\n</Project>\n';
		const cleanup = findProjectCleanup(CONFIG, catalog, PROJECTS, { ...NO_DISK_CONFIG, packagesPropsText: packagesProps });

		expect(cleanup.keptLines.filter(kept => kept.line.includes('Serilog')).map(kept => kept.projectPath)).toEqual(['src/Billing/Billing.csproj', 'tests/Billing.Tests/Billing.Tests.csproj']);
		expect(cleanup.edits.find(edit => edit.line.includes('Polly'))?.reason).toContain('already has Polly 8.0.0');
		expect(cleanup.keptLines.find(kept => kept.line.includes('8.1.0'))?.reason).toContain('Directory.Packages.props has Polly 8.0.0');
	});

	it('offers nothing a setting the generated files do not make would cover', () => {
		const config: WizardConfig = { versions: { sdkBand: '10.0.4xx' }, scopes: [{ path: '', tfms: ['net10.0'] }] };

		expect(findProjectCleanup(config, catalog, PROJECTS, NO_DISK_CONFIG).edits.map(edit => edit.line)).toEqual(['<LangVersion>14</LangVersion>']);
	});
});

describe('findProjectCleanup safety', () => {
	const project = (path: string, body: string) => ({ path, text: `<Project Sdk="Microsoft.NET.Sdk">\n${body}\n</Project>\n` });
	const offered = (projects: { path: string; text: string }[], diskConfig = NO_DISK_CONFIG) => findProjectCleanup(CONFIG, catalog, projects, diskConfig).edits.map(edit => edit.line);
	const kept = (projects: { path: string; text: string }[], diskConfig = NO_DISK_CONFIG) => findProjectCleanup(CONFIG, catalog, projects, diskConfig).keptLines.map(line => line.line);

	it('keeps LangVersion on a framework older than the SDK supports, where the compiler default is lower', () => {
		const generator = project('src/Generator/Generator.csproj', '\t<PropertyGroup>\n\t\t<TargetFramework>netstandard2.0</TargetFramework>\n\t\t<LangVersion>latest</LangVersion>\n\t</PropertyGroup>');

		expect(offered([generator])).toEqual([]);
		expect(kept([generator])).toEqual(['<LangVersion>latest</LangVersion>']);
	});

	it('says why it keeps LangVersion on a project targeting frameworks with different defaults', () => {
		const app = project('src/App/App.csproj', '\t<PropertyGroup>\n\t\t<TargetFrameworks>net10.0;net11.0</TargetFrameworks>\n\t\t<LangVersion>14.0</LangVersion>\n\t</PropertyGroup>');

		expect(findProjectCleanup(CONFIG, catalog, [app], NO_DISK_CONFIG).keptLines.map(line => line.reason)).toEqual([
			'Pins net10.0;net11.0 to one C# version; by default they use C# 14 and 15. Remove it by hand if each framework can use its default.'
		]);
	});

	it('keeps LangVersion when a Directory.Build.props above the project sets one too', () => {
		const app = project('src/App/App.csproj', '\t<PropertyGroup>\n\t\t<LangVersion>14</LangVersion>\n\t</PropertyGroup>');
		const diskConfig: DiskConfig = { packagesPropsText: undefined, readText: path => (path === 'Directory.Build.props' ? '<LangVersion>preview</LangVersion>' : undefined) };

		expect(offered([app], diskConfig)).toEqual([]);
		expect(findProjectCleanup(CONFIG, catalog, [app], diskConfig).keptLines[0].reason).toContain('Directory.Build.props sets LangVersion too');
	});

	it('leaves a property the project also sets in a conditional group, or after an import', () => {
		const conditional = project(
			'src/App/App.csproj',
			"\t<PropertyGroup Condition=\"'$(Configuration)' == 'Debug'\">\n\t\t<Nullable>disable</Nullable>\n\t</PropertyGroup>\n\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t</PropertyGroup>"
		);
		const imported = project('src/Lib/Lib.csproj', '\t<Import Project="..\\..\\build\\Common.props" />\n\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t</PropertyGroup>');

		expect(offered([conditional, imported])).toEqual([]);
	});

	it('moves no versions out of, and keeps the analyzers of, a project that turns central package management off', () => {
		const tool = project(
			'src/Tool/Tool.csproj',
			'\t<PropertyGroup>\n\t\t<ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>\n\t</PropertyGroup>\n\t<ItemGroup>\n\t\t<PackageReference Include="Serilog" Version="4.0.0" />\n\t\t<PackageReference Include="Meziantou.Analyzer" />\n\t</ItemGroup>'
		);

		expect(offered([tool])).toEqual([]);
	});

	it('keeps a property a props file above sets under a condition, or that CI builds set differently', () => {
		const app = project('src/App/App.csproj', '\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t</PropertyGroup>');
		const legacyProps = "<Project>\n\t<PropertyGroup Condition=\"'$(MSBuildProjectName)' == 'App'\">\n\t\t<Nullable>disable</Nullable>\n\t</PropertyGroup>\n</Project>\n";
		const diskConfig: DiskConfig = { packagesPropsText: undefined, readText: path => (path === 'Directory.Build.props' ? legacyProps : undefined) };
		const ciConfig: WizardConfig = { ...CONFIG, scopes: [{ ...CONFIG.scopes[0], ciBuild: { Nullable: 'disable' } }] };

		expect(findProjectCleanup(CONFIG, catalog, [app], diskConfig).keptLines.map(line => line.reason)).toEqual(['Directory.Build.props sets Nullable under a condition, which this line may override.']);
		expect(findProjectCleanup(ciConfig, catalog, [app], NO_DISK_CONFIG).keptLines.map(line => line.reason)).toEqual([
			'CI builds set Nullable to disable, and this line keeps the project at enable there.'
		]);
	});

	it("keeps LangVersion when the project's framework isn't known, rather than guess it", () => {
		const config: WizardConfig = { versions: { sdkBand: '10.0.4xx' }, scopes: [{ path: '', tfms: ['net10.0'] }] };
		const app = project('src/App/App.csproj', '\t<PropertyGroup>\n\t\t<LangVersion>14</LangVersion>\n\t</PropertyGroup>');

		expect(findProjectCleanup(config, catalog, [app], NO_DISK_CONFIG).keptLines[0].reason).toContain("can't tell which frameworks");
	});

	it('keeps an analyzer reference with metadata the generated one lacks', () => {
		const app = project('src/App/App.csproj', '\t<ItemGroup>\n\t\t<PackageReference Include="Meziantou.Analyzer" NoWarn="NU1608" />\n\t</ItemGroup>');

		expect(kept([app])).toEqual(['<PackageReference Include="Meziantou.Analyzer" NoWarn="NU1608" />']);
	});

	it('leaves projects in other languages alone, where settings such as LangVersion mean something else', () => {
		expect(offered([project('src/App/App.fsproj', '\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t</PropertyGroup>')])).toEqual([]);
	});

	it('ignores settings inside comments', () => {
		const app = project(
			'src/App/App.csproj',
			'\t<!--\n\t<PropertyGroup>\n\t\t<TargetFramework>net10.0</TargetFramework>\n\t</PropertyGroup>\n\t<ItemGroup>\n\t\t<PackageReference Include="Serilog" Version="3.0.0" />\n\t</ItemGroup>\n\t-->\n\t<PropertyGroup>\n\t\t<TargetFramework>net8.0</TargetFramework>\n\t\t<LangVersion>14</LangVersion>\n\t</PropertyGroup>'
		);

		expect(offered([app])).toEqual([]);
		expect(kept([app])).toEqual(['<LangVersion>14</LangVersion>']);
	});

	it('ignores Update and Remove items, and references with metadata of their own', () => {
		const tests = project(
			'tests/Billing.Tests/Billing.Tests.csproj',
			'\t<ItemGroup>\n\t\t<PackageReference Update="Serilog" Version="4.0.0" />\n\t\t<ProjectReference Include="..\\..\\src\\Billing\\Billing.csproj" Aliases="billing" />\n\t</ItemGroup>'
		);

		expect(offered([{ path: 'src/Billing/Billing.csproj', text: '<Project />\n' }, tests])).toEqual([]);
	});

	it('keeps an analyzer reference pinned to a different version than the generated one', () => {
		const app = project('src/App/App.csproj', '\t<ItemGroup>\n\t\t<PackageReference Include="Meziantou.Analyzer" Version="0.0.1" />\n\t</ItemGroup>');

		expect(kept([app])).toEqual(['<PackageReference Include="Meziantou.Analyzer" Version="0.0.1" />']);
	});

	it('reads central versions whatever order their attributes come in', () => {
		const app = project('src/App/App.csproj', '\t<ItemGroup>\n\t\t<PackageReference Include="Serilog" Version="4.0.0" />\n\t</ItemGroup>');
		const packagesPropsText = '<Project>\n\t<ItemGroup>\n\t\t<PackageVersion Version="4.0.0" Include="Serilog" />\n\t</ItemGroup>\n</Project>\n';
		const cleanup = findProjectCleanup(CONFIG, catalog, [app], { ...NO_DISK_CONFIG, packagesPropsText });

		expect(cleanup.edits[0].reason).toContain('already has Serilog 4.0.0');
		expect(toPackagesPropsWithVersions(packagesPropsText, [{ packageId: 'Serilog', version: '4.0.0' }])).toBe(packagesPropsText);
	});
});

describe('toCleanedProjects', () => {
	it('removes the chosen lines, moves versions out of package references, and drops groups left empty', () => {
		const cleanup = findProjectCleanup(CONFIG, catalog, PROJECTS, NO_DISK_CONFIG);
		const edits = cleanup.edits.filter(edit => edit.projectPath === 'src/Billing/Billing.csproj' || edit.line.startsWith('<ProjectReference'));

		const cleaned = toCleanedProjects(PROJECTS, edits);

		expect(cleaned.map(project => project.path)).toEqual(['src/Billing/Billing.csproj', 'tests/Billing.Tests/Billing.Tests.csproj']);
		expect(cleaned[0].text).toBe(`<Project Sdk="Microsoft.NET.Sdk">

	<PropertyGroup>
		<Nullable>enable</Nullable>
		<OutputType>Library</OutputType>
	</PropertyGroup>

	<PropertyGroup Condition="'$(Configuration)' == 'Release'">
		<Nullable>enable</Nullable>
	</PropertyGroup>

	<ItemGroup>
		<PackageReference Include="Serilog" />
	</ItemGroup>
</Project>
`);
		expect(cleaned[1].text).toContain('<ProjectReference Include="..\\Shared\\TestKit.csproj" />');
		expect(cleaned[1].text).not.toContain('src\\Billing');
	});

	it('leaves groups that were already empty', () => {
		const text = '<Project>\n\t<ItemGroup>\n\t</ItemGroup>\n\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t</PropertyGroup>\n</Project>\n';
		const app = { path: 'src/App/App.csproj', text };

		expect(toCleanedProjects([app], findProjectCleanup(CONFIG, catalog, [app], NO_DISK_CONFIG).edits)[0].text).toBe('<Project>\n\t<ItemGroup>\n\t</ItemGroup>\n</Project>\n');
	});

	it('drops a group whose every line goes, with the blank line before it', () => {
		const text = '<Project>\n\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t</PropertyGroup>\n\n\t<PropertyGroup>\n\t\t<LangVersion>14</LangVersion>\n\t</PropertyGroup>\n</Project>\n';
		const project = { path: 'src/App/App.csproj', text };
		const cleanup = findProjectCleanup(CONFIG, catalog, [project], NO_DISK_CONFIG);

		expect(toCleanedProjects([project], cleanup.edits)[0].text).toBe('<Project>\n</Project>\n');
	});
});

describe('toPackagesPropsWithVersions', () => {
	it('adds to the package versions group an earlier apply wrote, instead of writing a second one', () => {
		const once = toPackagesPropsWithVersions('<Project>\n</Project>\n', [{ packageId: 'Serilog', version: '4.0.0' }]);

		expect(toPackagesPropsWithVersions(once, [{ packageId: 'Polly', version: '8.0.0' }])).toBe(
			'<Project>\n\n\t<ItemGroup Label="Package versions">\n\t\t<PackageVersion Include="Serilog" Version="4.0.0" />\n\t\t<PackageVersion Include="Polly" Version="8.0.0" />\n\t</ItemGroup>\n</Project>\n'
		);
	});

	it('adds one version item per moved package it does not already have, sorted', () => {
		const text = '<Project>\n\t<ItemGroup>\n\t\t<PackageVersion Include="Polly" Version="8.0.0" />\n\t</ItemGroup>\n</Project>\n';

		const versions = [
			{ packageId: 'Serilog', version: '4.0.0' },
			{ packageId: 'Serilog', version: '4.0.0' },
			{ packageId: 'Polly', version: '8.0.0' },
			{ packageId: 'Humanizer', version: '2.14.1' }
		];

		expect(toPackagesPropsWithVersions(text, versions)).toBe(
			'<Project>\n\t<ItemGroup>\n\t\t<PackageVersion Include="Polly" Version="8.0.0" />\n\t</ItemGroup>\n\n\t<ItemGroup Label="Package versions">\n\t\t<PackageVersion Include="Humanizer" Version="2.14.1" />\n\t\t<PackageVersion Include="Serilog" Version="4.0.0" />\n\t</ItemGroup>\n</Project>\n'
		);
	});
});
