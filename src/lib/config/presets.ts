import { BANNED_API_SETS } from '../analyzers/bannedApis.ts';
import { getEffectiveSeverity, isReported } from '../analyzers/effectiveSeverity.ts';
import { findActiveOverlaps } from '../analyzers/overlaps.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { MICROSOFT_NAMING_SYMBOLS, NAMING_TEMPLATES } from '../naming/namingRule.ts';
import { NUGET_ORG } from '../packages/nugetConfig.ts';
import { SCOPE_PRESETS } from './scopePresets.ts';
import { resolveScope } from './scopes.ts';
import type { ProjectKind, ScopeConfig, Severity, WizardConfig } from './wizardConfig.ts';

export const PRESET_IDS = ['microsoft-defaults', 'microsoft-conventions', 'recommended', 'strict', 'library', 'service'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

/** Bumped whenever a preset's output changes, so share links made from an older preset can be told apart. */
export const PRESET_VERSION = 1;

export const PRESETS: Readonly<Record<PresetId, { title: string; description: string }>> = {
	'microsoft-defaults': { title: 'Microsoft defaults', description: 'Consistent whitespace and line endings; every rule keeps the SDK default.' },
	'microsoft-conventions': { title: 'Microsoft conventions', description: 'The C# coding conventions and naming Microsoft uses for .NET and its docs.' },
	recommended: { title: 'Recommended', description: 'Microsoft conventions enforced on build, with performance, security and supply-chain checks. Warnings fail CI builds.' },
	strict: { title: 'Strict', description: 'Recommended with Sonar, performance and security as errors, and warnings failing every build.' },
	library: { title: 'Library author', description: 'Recommended for packages: ConfigureAwait, AOT compatibility, public API tracking and package metadata.' },
	service: { title: 'Service', description: 'Recommended for apps and services, with ASP.NET Core-friendly banned APIs.' }
};

const FORMATTING: Record<string, Record<string, string>> = {
	'[*]': { charset: 'utf-8', end_of_line: 'lf', indent_style: 'space', indent_size: '4', insert_final_newline: 'true', trim_trailing_whitespace: 'true' },
	'[*.{csproj,props,targets,xml,slnx,config,nuspec,resx}]': { indent_size: '2' },
	'[*.json]': { indent_size: '2' },
	'[*.{yml,yaml}]': { indent_size: '2' },
	'[*.md]': { trim_trailing_whitespace: 'false' },
	'[*.{cmd,bat}]': { end_of_line: 'crlf' }
};

// Microsoft's C# coding conventions: https://learn.microsoft.com/dotnet/csharp/fundamentals/coding-style/coding-conventions
const CONVENTION_OPTIONS: Record<string, string> = {
	dotnet_sort_system_directives_first: 'true',
	dotnet_style_qualification_for_field: 'false',
	dotnet_style_qualification_for_property: 'false',
	dotnet_style_qualification_for_method: 'false',
	dotnet_style_qualification_for_event: 'false',
	dotnet_style_predefined_type_for_locals_parameters_members: 'true',
	dotnet_style_predefined_type_for_member_access: 'true',
	dotnet_style_parentheses_in_arithmetic_binary_operators: 'always_for_clarity',
	dotnet_style_parentheses_in_relational_binary_operators: 'always_for_clarity',
	dotnet_style_parentheses_in_other_binary_operators: 'always_for_clarity',
	dotnet_style_parentheses_in_other_operators: 'never_if_unnecessary',
	dotnet_style_object_initializer: 'true',
	dotnet_style_collection_initializer: 'true',
	dotnet_style_prefer_collection_expression: 'when_types_loosely_match',
	csharp_style_implicit_object_creation_when_type_is_apparent: 'true',
	csharp_style_var_for_built_in_types: 'false',
	csharp_style_var_when_type_is_apparent: 'true',
	csharp_style_var_elsewhere: 'false',
	csharp_style_namespace_declarations: 'file_scoped',
	csharp_using_directive_placement: 'outside_namespace',
	csharp_prefer_simple_using_statement: 'true',
	csharp_prefer_braces: 'true',
	csharp_style_prefer_primary_constructors: 'true',
	csharp_prefer_system_threading_lock: 'true',
	csharp_new_line_before_open_brace: 'all',
	csharp_new_line_before_else: 'true',
	csharp_new_line_before_catch: 'true',
	csharp_new_line_before_finally: 'true'
};

const CONVENTION_SEVERITIES: Record<string, Severity> = {
	IDE0007: 'suggestion',
	IDE0008: 'suggestion',
	IDE0063: 'suggestion',
	IDE0090: 'suggestion',
	IDE0161: 'warning',
	IDE0065: 'warning',
	IDE0011: 'warning',
	CA1031: 'warning'
};

// Goal C1: consistent style everyone's build enforces. C4: new language features as the target framework allows them.
const RECOMMENDED_SEVERITIES: Record<string, Severity> = {
	IDE0055: 'warning',
	IDE0005: 'warning',
	IDE0076: 'error',
	IDE0077: 'error',
	IDE0300: 'warning',
	IDE0301: 'warning',
	IDE0302: 'warning',
	IDE0303: 'warning',
	IDE0304: 'warning',
	IDE0305: 'warning',
	IDE0330: 'warning',
	// Captured primary constructor parameters are mutable, so this one stays a suggestion.
	IDE0290: 'suggestion',
	// Goal C2: logging and async correctness.
	CA1848: 'warning',
	CA2254: 'warning',
	CA1873: 'warning',
	CA2012: 'warning',
	CA2016: 'warning',
	CA1849: 'warning',
	MA0134: 'warning',
	MA0155: 'warning',
	// Goal C3: security.
	MA0009: 'error',
	MA0039: 'error'
};

const RECOMMENDED_BUILD: Record<string, string> = {
	Nullable: 'enable',
	ImplicitUsings: 'enable',
	AnalysisLevel: 'latest-recommended',
	EnforceCodeStyleInBuild: 'true',
	GenerateDocumentationFile: 'true',
	WarningsAsErrors: 'nullable',
	// Newly published advisories stay warnings, so they don't fail builds that treat warnings as errors.
	WarningsNotAsErrors: 'NU1901;NU1902;NU1903;NU1904',
	Deterministic: 'true',
	ManagePackageVersionsCentrally: 'true',
	CentralPackageTransitivePinningEnabled: 'true',
	CentralPackageVersionOverrideEnabled: 'false',
	NuGetAudit: 'true',
	NuGetAuditMode: 'all',
	NuGetAuditLevel: 'low',
	RestorePackagesWithLockFile: 'true'
};

const LIBRARY_BUILD: Record<string, string> = {
	IsAotCompatible: 'true',
	PublishRepositoryUrl: 'true',
	EmbedUntrackedSources: 'true',
	IncludeSymbols: 'true',
	SymbolPackageFormat: 'snupkg',
	EnablePackageValidation: 'true'
};

const MEZIANTOU = 'Meziantou.Analyzer';
const BANNED_API = 'Microsoft.CodeAnalysis.BannedApiAnalyzers';
const SONAR = 'SonarAnalyzer.CSharp';
const PUBLIC_API = 'Microsoft.CodeAnalysis.PublicApiAnalyzers';

/**
 * Builds a preset for an SDK band. Rules the band doesn't have are left out, and any concern that two active analyzers
 * check ends with one active rule, so no preset ships duplicate warnings.
 */
export function toPresetConfig(presetId: PresetId, catalog: Catalog): WizardConfig {
	const tfms = [`net${catalog.band.channel}`];
	const root: ScopeConfig = { path: '', tfms, formatting: structuredClone(FORMATTING) };
	const config: WizardConfig = { versions: { sdkBand: catalog.band.band }, scopes: [root] };
	if (presetId === 'microsoft-defaults') return config;

	root.options = { ...CONVENTION_OPTIONS };
	root.severities = { ...CONVENTION_SEVERITIES };
	root.naming = NAMING_TEMPLATES.filter(template => MICROSOFT_NAMING_SYMBOLS.includes(template.symbols)).map(template => structuredClone(template));
	root.build = { EnforceCodeStyleInBuild: 'true' };
	if (presetId === 'microsoft-conventions') return withoutUnknownRules(config, catalog);

	const projectKind: ProjectKind | undefined = presetId === 'library' ? 'library' : presetId === 'service' ? 'service' : undefined;
	if (projectKind) root.projectKind = projectKind;

	root.severities = { ...root.severities, ...RECOMMENDED_SEVERITIES };
	// XML docs are generated for IDE0005 to run on build; outside libraries, missing docs aren't worth a warning.
	if (projectKind !== 'library') root.severities.CS1591 = 'none';
	root.categorySeverities = { Performance: 'warning', Security: 'error' };
	root.build = { ...root.build, ...RECOMMENDED_BUILD };
	root.ciBuild = { TreatWarningsAsErrors: 'true', RestoreLockedMode: 'true' };
	root.packages = [MEZIANTOU, BANNED_API];
	root.bannedApis = BANNED_API_SETS.filter(set => set.projectKinds.includes(projectKind ?? 'service')).flatMap(set => set.apis);
	config.nuget = { sources: [{ ...NUGET_ORG, patterns: ['*'] }], auditSourceUrl: NUGET_ORG.url };
	config.globalJson = { rollForward: 'latestFeature', isTestingPlatformRunner: false, msbuildSdks: {} };

	if (presetId === 'strict') {
		root.categorySeverities.Performance = 'error';
		root.severities = { ...root.severities, CA1848: 'error', CA2254: 'error', S3267: 'none' };
		root.build.TreatWarningsAsErrors = 'true';
		delete root.ciBuild.TreatWarningsAsErrors;
		root.packages = [...root.packages, SONAR];
	}

	if (presetId === 'library') {
		root.severities.CA2007 = 'warning';
		root.build = { ...root.build, ...LIBRARY_BUILD };
		root.packages = [...root.packages, PUBLIC_API];
	}

	const testsScope = structuredClone(SCOPE_PRESETS.find(preset => preset.scope.path === 'tests')?.scope ?? { path: 'tests' });
	// Test projects aren't shipped, so they don't inherit a library's AOT compatibility.
	if (root.build.IsAotCompatible === 'true') testsScope.build = { ...testsScope.build, IsAotCompatible: 'false' };
	config.scopes.push(testsScope);
	return withoutDuplicateRules(withoutUnknownRules(config, catalog), catalog);
}

/** Drops severities for rules the band doesn't have, such as CA1873 before SDK 10. */
function withoutUnknownRules(config: WizardConfig, catalog: Catalog): WizardConfig {
	for (const scope of config.scopes) {
		if (scope.severities) scope.severities = Object.fromEntries(Object.entries(scope.severities).filter(([id]) => catalog.rules.has(id)));
	}

	return config;
}

/** Turns off every duplicate the overlap map finds, scope by scope, keeping each concern's owner. */
function withoutDuplicateRules(config: WizardConfig, catalog: Catalog): WizardConfig {
	for (const scope of config.scopes) {
		const resolved = resolveScope(config, scope);
		const overlaps = findActiveOverlaps(catalog, rule => (!rule.packageId || resolved.packages.includes(rule.packageId)) && isReported(getEffectiveSeverity(rule, resolved, catalog)));
		for (const duplicate of overlaps.flatMap(overlap => overlap.duplicates)) {
			scope.severities ??= {};
			scope.severities[duplicate.id] = 'none';
		}
	}

	return config;
}
