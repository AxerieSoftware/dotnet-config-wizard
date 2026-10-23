import { describe, expect, it } from 'vitest';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import type { DiskConfig } from './projectCleanup.ts';
import { findRepeatedSettings } from './repeatedSettings.ts';

const NO_DISK_CONFIG: DiskConfig = { packagesPropsText: undefined, readText: () => undefined };

function toConfig(...scopes: ScopeConfig[]): WizardConfig {
	return { versions: { sdkBand: '10.0.4xx' }, scopes: [{ path: '', tfms: ['net10.0'] }, ...scopes] };
}

function project(path: string, properties: string): { path: string; text: string } {
	return { path, text: `<Project Sdk="Microsoft.NET.Sdk">\n\t<PropertyGroup>\n${properties}\n\t</PropertyGroup>\n</Project>\n` };
}

const NULLABLE = '\t\t<Nullable>enable</Nullable>';

describe('findRepeatedSettings', () => {
	it('offers a property every project a folder reaches sets alike, for the outermost folder it fits', () => {
		const projects = [project('src/Billing/Billing.csproj', NULLABLE), project('src/Shipping/Shipping.csproj', NULLABLE), project('tests/Billing.Tests/Billing.Tests.csproj', NULLABLE)];

		expect(findRepeatedSettings(toConfig({ path: 'src' }, { path: 'tests' }), projects, NO_DISK_CONFIG)).toEqual([
			{ folderPath: '', isNewFolder: false, name: 'Nullable', value: 'enable', projectPaths: projects.map(entry => entry.path) }
		]);
	});

	it('offers it for the inner folder when a project the outer one reaches lacks it', () => {
		const projects = [project('src/Billing/Billing.csproj', NULLABLE), project('src/Shipping/Shipping.csproj', NULLABLE), project('tests/Billing.Tests/Billing.Tests.csproj', '')];

		expect(findRepeatedSettings(toConfig({ path: 'src' }, { path: 'tests' }), projects, NO_DISK_CONFIG).map(setting => setting.folderPath)).toEqual(['src']);
	});

	it('offers to add a folder just below a wizard folder when only its projects repeat a setting', () => {
		const projects = [project('src/Billing/Billing.csproj', NULLABLE), project('src/Shipping/Shipping.csproj', NULLABLE), project('tests/Billing.Tests/Billing.Tests.csproj', '')];

		expect(findRepeatedSettings(toConfig(), projects, NO_DISK_CONFIG)).toEqual([
			{ folderPath: 'src', isNewFolder: true, name: 'Nullable', value: 'enable', projectPaths: ['src/Billing/Billing.csproj', 'src/Shipping/Shipping.csproj'] }
		]);
	});

	it('leaves out projects whose own folder sets the property, since the setting would not reach them', () => {
		const projects = [project('src/Billing/Billing.csproj', '\t\t<Nullable>disable</Nullable>'), project('tests/A.Tests/A.Tests.csproj', NULLABLE), project('tests/B.Tests/B.Tests.csproj', NULLABLE)];
		const settings = findRepeatedSettings(toConfig({ path: 'src', build: { Nullable: 'disable' } }, { path: 'tests' }), projects, NO_DISK_CONFIG);

		expect(settings).toEqual([{ folderPath: '', isNewFolder: false, name: 'Nullable', value: 'enable', projectPaths: ['tests/A.Tests/A.Tests.csproj', 'tests/B.Tests/B.Tests.csproj'] }]);
	});

	it('offers shared target frameworks the wizard supports, and spells values the way it offers them', () => {
		const projects = [
			project('src/A/A.csproj', '\t\t<TargetFramework>net10.0</TargetFramework>\n\t\t<Deterministic>True</Deterministic>'),
			project('src/B/B.csproj', '\t\t<TargetFramework>net10.0</TargetFramework>\n\t\t<Deterministic>true</Deterministic>')
		];

		expect(findRepeatedSettings(toConfig(), projects, NO_DISK_CONFIG).map(setting => `${setting.name}=${setting.value}`)).toEqual(['TargetFramework=net10.0', 'Deterministic=true']);
	});

	it('offers nothing for one project, unknown or list properties, older frameworks, or what the folder already sets', () => {
		const projects = [
			project('src/A/A.csproj', '\t\t<TargetFramework>net8.0</TargetFramework>\n\t\t<OutputType>Exe</OutputType>\n\t\t<WarningsAsErrors>nullable</WarningsAsErrors>\n\t\t<Nullable>enable</Nullable>'),
			project('src/B/B.csproj', '\t\t<TargetFramework>net8.0</TargetFramework>\n\t\t<OutputType>Exe</OutputType>\n\t\t<WarningsAsErrors>nullable</WarningsAsErrors>\n\t\t<Nullable>enable</Nullable>')
		];

		expect(findRepeatedSettings(toConfig({ path: 'src', build: { Nullable: 'enable' } }), projects, NO_DISK_CONFIG)).toEqual([]);
		expect(findRepeatedSettings(toConfig(), [project('src/A/A.csproj', NULLABLE)], NO_DISK_CONFIG)).toEqual([]);
	});

	it('offers nothing when a folder below sets the property only for CI builds, which it would still inherit locally', () => {
		const projects = [
			project('src/A/A.csproj', '\t\t<TreatWarningsAsErrors>true</TreatWarningsAsErrors>'),
			project('src/B/B.csproj', '\t\t<TreatWarningsAsErrors>true</TreatWarningsAsErrors>'),
			project('tests/C.Tests/C.Tests.csproj', '')
		];

		expect(findRepeatedSettings(toConfig({ path: 'src' }, { path: 'tests', ciBuild: { TreatWarningsAsErrors: 'true' } }), projects, NO_DISK_CONFIG).map(setting => setting.folderPath)).toEqual([
			'src'
		]);
	});

	it('offers no frameworks for a folder with a folder below that has frameworks or sharing of its own', () => {
		const projects = [project('src/A/A.csproj', '\t\t<TargetFrameworks>net10.0;net11.0</TargetFrameworks>'), project('src/B/B.csproj', '\t\t<TargetFrameworks>net10.0;net11.0</TargetFrameworks>')];

		expect(findRepeatedSettings(toConfig({ path: 'tests', tfms: ['net10.0'] }), projects, NO_DISK_CONFIG).filter(setting => setting.folderPath === '')).toEqual([]);
		expect(findRepeatedSettings(toConfig({ path: 'tests', isTargetFrameworkShared: true }), projects, NO_DISK_CONFIG).filter(setting => setting.folderPath === '')).toEqual([]);
	});

	it('offers no packed files or property references, which mean something else in props, or package versions, which match only by chance', () => {
		const properties = '\t\t<PackageReadmeFile>README.md</PackageReadmeFile>\n\t\t<ErrorLog>$(OutDir)build.sarif</ErrorLog>\n\t\t<VersionPrefix>0.1.0</VersionPrefix>';

		expect(findRepeatedSettings(toConfig(), [project('src/A/A.csproj', properties), project('src/B/B.csproj', properties)], NO_DISK_CONFIG)).toEqual([]);
	});

	it('reads escaped text as the text it stands for', () => {
		const properties = '\t\t<Company>Contoso &amp; Co</Company>';

		expect(findRepeatedSettings(toConfig(), [project('src/A/A.csproj', properties), project('src/B/B.csproj', properties)], NO_DISK_CONFIG).map(setting => setting.value)).toEqual(['Contoso & Co']);
	});

	it('counts projects of any MSBuild language, which the props reach too', () => {
		const projects = [project('src/A/A.csproj', NULLABLE), project('src/B/B.csproj', NULLABLE), project('src/C/C.fsproj', '')];

		expect(findRepeatedSettings(toConfig(), projects, NO_DISK_CONFIG)).toEqual([]);
	});

	it('keeps the inner offer when the outer one does not reach its projects', () => {
		const projects = [project('src/A/A.csproj', NULLABLE), project('src/B/B.csproj', NULLABLE), project('tests/C.Tests/C.Tests.csproj', NULLABLE), project('tests/D.Tests/D.Tests.csproj', NULLABLE)];

		expect(findRepeatedSettings(toConfig({ path: 'src', build: { Nullable: 'disable' } }, { path: 'tests' }), projects, NO_DISK_CONFIG).map(setting => setting.folderPath)).toEqual(['', 'src']);
	});

	it('offers nothing a props file between the folder and a project sets under a condition', () => {
		const projects = [project('src/A/A.csproj', NULLABLE), project('src/B/B.csproj', NULLABLE)];
		const diskConfig: DiskConfig = {
			packagesPropsText: undefined,
			readText: path =>
				path === 'src/A/Directory.Build.props'
					? "<Project>\n\t<PropertyGroup Condition=\"'$(Configuration)' == 'Debug'\">\n\t\t<Nullable>disable</Nullable>\n\t</PropertyGroup>\n</Project>\n"
					: undefined
		};

		expect(findRepeatedSettings(toConfig(), projects, diskConfig)).toEqual([]);
	});

	it('offers nothing a props file above sets under a condition', () => {
		const projects = [project('src/A/A.csproj', NULLABLE), project('src/B/B.csproj', NULLABLE)];
		const diskConfig: DiskConfig = {
			packagesPropsText: undefined,
			readText: path =>
				path === 'Directory.Build.props' ? "<Project>\n\t<PropertyGroup Condition=\"'$(Configuration)' == 'Debug'\">\n\t\t<Nullable>disable</Nullable>\n\t</PropertyGroup>\n</Project>\n" : undefined
		};

		expect(findRepeatedSettings(toConfig(), projects, diskConfig)).toEqual([]);
	});
});
