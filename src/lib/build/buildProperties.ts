import type { ProjectKind } from '../config/wizardConfig.ts';

/** Which generated file a property belongs in. */
export type PropertyFile = 'props' | 'packages';

export type BuildProperty = {
	name: string;
	group: string;
	description: string;
	/** Allowed values; an empty list means free text. */
	values: readonly string[];
	file: PropertyFile;
	/** Semicolon-separated lists, such as WarningsAsErrors, append to the inherited value instead of replacing it. */
	isList?: boolean;
	/** Whether the property can be limited to CI builds, such as TreatWarningsAsErrors. */
	canBeCiOnly?: boolean;
	/** Project kinds the property suits; the wizard shows it for every kind when unset. */
	projectKinds?: readonly ProjectKind[];
	/** Placeholder text for free-text properties. */
	example?: string;
	/** Set on the Analyzers step rather than the Build step. */
	isOnAnalyzersStep?: boolean;
	/** Applies to the whole repo, so only the root scope can set it. */
	isRepoWide?: boolean;
};

const BOOLEAN = ['true', 'false'] as const;

/**
 * The MSBuild properties the wizard offers, in the groups and order they're written. LangVersion, WarningLevel and NoWarn
 * are deliberately absent: the C# version and warning waves follow the target framework and AnalysisLevel, and
 * suppressions belong in .editorconfig.
 */
export const BUILD_PROPERTIES: readonly BuildProperty[] = [
	{ name: 'Nullable', group: 'Language', description: 'Nullable reference types.', values: ['enable', 'warnings', 'annotations', 'disable'], file: 'props' },
	{ name: 'ImplicitUsings', group: 'Language', description: 'Global usings for common namespaces.', values: ['enable', 'disable'], file: 'props' },
	{
		name: 'EnablePreviewFeatures',
		group: 'Language',
		description: 'Allows preview APIs and runtime features a preview SDK ships behind RequiresPreviewFeatures. Leave it off on a released SDK.',
		values: BOOLEAN,
		file: 'props'
	},

	{ name: 'AnalysisLevel', group: 'Analysis', description: 'Which .NET analyzer rules are on; `latest-<mode>` tracks the SDK.', values: [], file: 'props', isOnAnalyzersStep: true },
	{ name: 'EnforceCodeStyleInBuild', group: 'Analysis', description: 'Runs IDE code-style rules on build, not just in the editor.', values: BOOLEAN, file: 'props', isOnAnalyzersStep: true },
	{ name: 'GenerateDocumentationFile', group: 'Analysis', description: 'Writes XML docs, which IDE0005 needs to run on build.', values: BOOLEAN, file: 'props' },
	{
		name: 'ErrorLog',
		group: 'Analysis',
		description: 'A SARIF log of every diagnostic, for code-scanning tools in CI.',
		values: [],
		file: 'props',
		canBeCiOnly: true,
		example: '$(MSBuildProjectName).sarif,version=2.1'
	},

	{ name: 'TreatWarningsAsErrors', group: 'Warnings', description: 'Turns every compiler and analyzer warning into an error.', values: BOOLEAN, file: 'props', canBeCiOnly: true },
	{
		name: 'MSBuildTreatWarningsAsErrors',
		group: 'Warnings',
		description: 'Turns MSBuild warnings into errors; TreatWarningsAsErrors only covers the compiler.',
		values: BOOLEAN,
		file: 'props',
		canBeCiOnly: true
	},
	{
		name: 'WarningsAsErrors',
		group: 'Warnings',
		description: 'Warnings that fail the build even without TreatWarningsAsErrors. `nullable` covers every nullable warning.',
		values: [],
		file: 'props',
		isList: true,
		example: 'nullable'
	},
	{
		name: 'WarningsNotAsErrors',
		group: 'Warnings',
		description: 'Warnings that stay warnings under TreatWarningsAsErrors, such as NuGet audit warnings.',
		values: [],
		file: 'props',
		isList: true,
		example: 'NU1901;NU1902;NU1903;NU1904'
	},

	{ name: 'Deterministic', group: 'Reproducible builds', description: 'The same inputs always produce the same binary.', values: BOOLEAN, file: 'props' },
	{ name: 'UseArtifactsOutput', group: 'Reproducible builds', description: "Puts every project's bin and obj under one artifacts folder.", values: BOOLEAN, file: 'props' },
	{ name: 'DebugType', group: 'Reproducible builds', description: 'Where debug symbols go.', values: ['portable', 'embedded'], file: 'props' },
	{ name: 'InvariantGlobalization', group: 'Reproducible builds', description: 'Runs with invariant culture, without ICU.', values: BOOLEAN, file: 'props' },

	{
		name: 'PublishRepositoryUrl',
		group: 'Source Link and symbols',
		description: 'Records the repository URL in the package, for Source Link.',
		values: BOOLEAN,
		file: 'props',
		projectKinds: ['library']
	},
	{ name: 'EmbedUntrackedSources', group: 'Source Link and symbols', description: "Embeds generated sources Source Link can't fetch.", values: BOOLEAN, file: 'props', projectKinds: ['library'] },
	{
		name: 'EmbedAllSources',
		group: 'Source Link and symbols',
		description: "Embeds every source file in the symbols, so debugging works offline and for private repos the debugger can't reach.",
		values: BOOLEAN,
		file: 'props',
		projectKinds: ['library']
	},
	{ name: 'IncludeSymbols', group: 'Source Link and symbols', description: 'Publishes a symbol package next to the package.', values: BOOLEAN, file: 'props', projectKinds: ['library'] },
	{ name: 'SymbolPackageFormat', group: 'Source Link and symbols', description: 'The symbol package format nuget.org accepts.', values: ['snupkg'], file: 'props', projectKinds: ['library'] },

	{
		name: 'VersionPrefix',
		group: 'Package metadata',
		description: 'One version every package here shares, such as `1.4.0`. Leave it unset to version each package in its own project file. CI can add a `VersionSuffix` for prereleases.',
		values: [],
		file: 'props',
		projectKinds: ['library'],
		example: '1.0.0'
	},
	{ name: 'Authors', group: 'Package metadata', description: "Your or your organization's display name.", values: [], file: 'props', projectKinds: ['library'], example: 'Contoso' },
	{ name: 'Company', group: 'Package metadata', description: 'The company that owns the code.', values: [], file: 'props', projectKinds: ['library'], example: 'Contoso' },
	{
		name: 'Copyright',
		group: 'Package metadata',
		description: 'A fixed notice with the year written in; a computed year breaks reproducible builds.',
		values: [],
		file: 'props',
		projectKinds: ['library'],
		example: 'Copyright (c) Contoso 2026'
	},
	{
		name: 'PackageProjectUrl',
		group: 'Package metadata',
		description: "The project's home page or repository.",
		values: [],
		file: 'props',
		projectKinds: ['library'],
		example: 'https://github.com/contoso/widgets'
	},
	{
		name: 'PackageLicenseExpression',
		group: 'Package metadata',
		description: 'An SPDX license expression.',
		values: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'MPL-2.0'],
		file: 'props',
		projectKinds: ['library']
	},
	{
		name: 'PackageReadmeFile',
		group: 'Package metadata',
		description: 'A README packed into every package, from the folder this file is in.',
		values: [],
		file: 'props',
		projectKinds: ['library'],
		example: 'README.md'
	},
	{
		name: 'PackageIcon',
		group: 'Package metadata',
		description: 'A 128×128 PNG packed into every package, from the folder this file is in.',
		values: [],
		file: 'props',
		projectKinds: ['library'],
		example: 'icon.png'
	},
	{
		name: 'PackageReleaseNotes',
		group: 'Package metadata',
		description: 'Release notes, or a link to the changelog.',
		values: [],
		file: 'props',
		projectKinds: ['library'],
		example: 'https://github.com/contoso/widgets/blob/main/CHANGELOG.md'
	},
	{
		name: 'EnablePackageValidation',
		group: 'Package metadata',
		description: 'Checks the package for breaking changes and consistency when packing.',
		values: BOOLEAN,
		file: 'props',
		projectKinds: ['library']
	},
	{
		name: 'PackageValidationBaselineVersion',
		group: 'Package metadata',
		description: 'A version already published to your feed; restore downloads it for package validation to compare against.',
		values: [],
		file: 'props',
		projectKinds: ['library'],
		example: '1.0.0'
	},

	{
		name: 'IsAotCompatible',
		group: 'Trimming and AOT',
		description: 'Marks a library as Native AOT compatible and turns on the trim and AOT analyzers.',
		values: BOOLEAN,
		file: 'props',
		projectKinds: ['library']
	},
	{ name: 'PublishAot', group: 'Trimming and AOT', description: 'Publishes a service as a Native AOT executable.', values: BOOLEAN, file: 'props', projectKinds: ['service'] },
	{ name: 'EnableTrimAnalyzer', group: 'Trimming and AOT', description: 'Runs the trim analyzer without publishing trimmed.', values: BOOLEAN, file: 'props', projectKinds: ['library', 'service'] },
	{
		name: 'EnableAotAnalyzer',
		group: 'Trimming and AOT',
		description: 'Runs the AOT analyzer without publishing as Native AOT.',
		values: BOOLEAN,
		file: 'props',
		projectKinds: ['library', 'service']
	},

	{ name: 'IsPackable', group: 'Projects', description: 'Whether `dotnet pack` packs these projects.', values: BOOLEAN, file: 'props' },

	{ name: 'NuGetAudit', group: 'NuGet audit and lock files', description: 'Warns about packages with known vulnerabilities on restore.', values: BOOLEAN, file: 'props' },
	{ name: 'NuGetAuditMode', group: 'NuGet audit and lock files', description: 'Audit direct references only, or the whole graph.', values: ['all', 'direct'], file: 'props' },
	{ name: 'NuGetAuditLevel', group: 'NuGet audit and lock files', description: 'The lowest severity to report.', values: ['low', 'moderate', 'high', 'critical'], file: 'props' },
	{ name: 'RestorePackagesWithLockFile', group: 'NuGet audit and lock files', description: 'Writes packages.lock.json so restores are repeatable.', values: BOOLEAN, file: 'props' },
	{
		name: 'RestoreLockedMode',
		group: 'NuGet audit and lock files',
		description: 'Fails restore when packages.lock.json is out of date. Commit the lock files first.',
		values: BOOLEAN,
		file: 'props',
		canBeCiOnly: true
	},

	{
		name: 'ManagePackageVersionsCentrally',
		group: 'Central package management',
		description: 'Package versions live in Directory.Packages.props instead of each project.',
		values: BOOLEAN,
		file: 'packages',
		isRepoWide: true
	},
	{
		name: 'CentralPackageTransitivePinningEnabled',
		group: 'Central package management',
		description: 'Central versions also pin transitive packages.',
		values: BOOLEAN,
		file: 'packages',
		isRepoWide: true
	},
	{
		name: 'CentralPackageVersionOverrideEnabled',
		group: 'Central package management',
		description: 'Whether a project may override a central version.',
		values: BOOLEAN,
		file: 'packages',
		isRepoWide: true
	}
];

export const BUILD_PROPERTIES_BY_NAME: ReadonlyMap<string, BuildProperty> = new Map(BUILD_PROPERTIES.map(property => [property.name, property]));
