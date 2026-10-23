import { MSTEST_PACKAGE, PUBLIC_API_PACKAGE } from '../analyzers/analyzerPackages.ts';
import { BANNED_API_SETS } from '../analyzers/bannedApis.ts';
import { getEffectiveSeverity, isReported } from '../analyzers/effectiveSeverity.ts';
import { findActiveOverlaps } from '../analyzers/overlaps.ts';
import { isSameList } from '../build/msbuildValues.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { MICROSOFT_NAMING_SYMBOLS, NAMING_TEMPLATES, type NamingRule } from '../naming/namingRule.ts';
import { NUGET_ORG } from '../packages/nugetConfig.ts';
import { type ResolvedScope, resolveInheritedScope, resolveScope } from './scopes.ts';
import type { ProjectKind, ScopeConfig, Severity, WizardConfig } from './wizardConfig.ts';

/** A preset is a strictness level. What each folder holds is set on the folder, and brings that kind's defaults with it. */
export const PRESET_LEVELS = ['microsoft-defaults', 'microsoft-conventions', 'recommended', 'strict', 'opinionated'] as const;
export type Preset = (typeof PRESET_LEVELS)[number];

export const DEFAULT_PRESET: Preset = 'microsoft-defaults';

export const PRESET_LEVEL_DETAILS: Readonly<Record<Preset, { title: string; description: string }>> = {
	'microsoft-defaults': { title: 'Microsoft defaults', description: 'Whitespace and line endings only. Rules keep SDK defaults.' },
	'microsoft-conventions': { title: 'Microsoft conventions', description: "Microsoft's C# coding and naming conventions." },
	recommended: { title: 'Recommended', description: 'Conventions enforced on build, plus performance, security and supply-chain checks. Warnings fail CI.' },
	strict: { title: 'Strict', description: 'Adds Sonar and Meziantou. Performance and security are errors; warnings fail every build.' },
	opinionated: { title: 'Opinionated', description: 'Adds one house style: tabs, this., var everywhere, pattern matching.' }
};

/** A preset's display name, such as `Strict`. */
export function toPresetName(preset: Preset): string {
	return PRESET_LEVEL_DETAILS[preset].title;
}

const FORMATTING: Record<string, Record<string, string>> = {
	'[*]': { charset: 'utf-8', end_of_line: 'lf', indent_style: 'space', indent_size: '4', insert_final_newline: 'true', trim_trailing_whitespace: 'true' },
	'[*.{csproj,props,targets,xml,sln,slnx,config,nuspec,resx}]': { indent_size: '2' },
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
	IDE0330: 'warning',
	// Captured primary constructor parameters are mutable, so this one stays a suggestion.
	IDE0290: 'suggestion',
	// Goal C2: logging and async correctness.
	CA1848: 'warning',
	CA2254: 'warning',
	CA1873: 'warning',
	CA2012: 'warning',
	CA2016: 'warning',
	CA1849: 'warning'
};

// Modifier hygiene, collection expressions, and dead or redundant code. Most have a one-click fix but flag much of an
// existing codebase on day one, so they're Strict rather than Recommended.
const STRICT_SEVERITIES: Record<string, Severity> = {
	IDE0036: 'warning',
	IDE0040: 'warning',
	IDE0062: 'warning',
	IDE0250: 'warning',
	IDE0251: 'warning',
	IDE0320: 'warning',
	IDE0300: 'warning',
	IDE0301: 'warning',
	IDE0302: 'warning',
	IDE0303: 'warning',
	IDE0304: 'warning',
	IDE0305: 'warning',
	IDE0044: 'warning',
	// Parentheses, following the conventions' clarity options.
	IDE0047: 'warning',
	IDE0048: 'warning',
	// Dead and redundant code.
	IDE0051: 'warning',
	IDE0052: 'warning',
	IDE0059: 'warning',
	IDE0004: 'warning',
	IDE0080: 'warning',
	IDE0100: 'warning',
	IDE0110: 'warning',
	IDE0240: 'warning',
	IDE0241: 'warning',
	IDE0370: 'warning',
	IDE0380: 'warning',
	IDE0082: 'warning',
	IDE0280: 'warning',
	IDE0017: 'warning',
	IDE0028: 'warning',
	IDE0306: 'warning',
	IDE0032: 'warning',
	IDE0070: 'warning',
	IDE0120: 'warning',
	IDE0121: 'warning',
	IDE0200: 'warning',
	IDE1005: 'warning',
	IDE0043: 'error',
	// Design and reliability rules that catch real mistakes; latest-recommended leaves them off.
	CA1012: 'warning',
	CA1052: 'warning',
	CA1063: 'warning',
	CA1065: 'warning',
	CA1066: 'warning',
	CA2002: 'warning',
	CA2025: 'warning',
	CA2213: 'warning',
	CA2214: 'warning',
	// The build never runs these, but the editor still flags them.
	IDE0001: 'warning',
	IDE0002: 'warning',
	IDE0079: 'warning'
};

// Analyzer package rules that ship disabled. Strict takes the ones that catch real bugs; Opinionated adds the ones that
// enforce its house style. Rules that duplicate an IDE or CA rule are left to the overlap map's owner.
const STRICT_ANALYZER_RULES = [
	// Meziantou: logic slips, nullable annotations, EventSource correctness, process safety and redundant arguments.
	'MA0161',
	'MA0162',
	'MA0170',
	'MA0172',
	'MA0180',
	'MA0184',
	'MA0186',
	'MA0221',
	'MA0226',
	'MA0228',
	'MA0229',
	'MA0230',
	'MA0231',
	'MA0232',
	'MA0233',
	'MA0234',
	'MA0235',
	'MA0236',
	'MA0237',
	'MA0238',
	'MA0108',
	// Sonar: equality and comparison bugs, locking on locals, archive extraction and redundant code.
	'S1698',
	'S1858',
	'S2197',
	'S2387',
	'S2692',
	'S2760',
	'S3249',
	'S5042',
	'S6507'
];

const OPINIONATED_ANALYZER_RULES = [
	// Async suffixes, from Microsoft's threading analyzers.
	'VSTHRD200',
	// Meziantou: TimeProvider, cancellation everywhere, `is null` patterns and immutable parameters.
	'MA0032',
	'MA0080',
	'MA0121',
	'MA0141',
	'MA0142',
	'MA0148',
	'MA0149',
	'MA0167',
	'MA0171',
	'MA0177',
	'MA0213',
	'MA0222',
	'MA0223',
	'MA0224',
	'MA0225',
	// Sonar: nesting depth, cognitive complexity and DateTimeOffset.
	'S134',
	'S3776',
	'S6566'
];

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
	IsPackable: 'true',
	IsAotCompatible: 'true',
	PublishRepositoryUrl: 'true',
	EmbedUntrackedSources: 'true',
	IncludeSymbols: 'true',
	SymbolPackageFormat: 'snupkg',
	EnablePackageValidation: 'true'
};

// One house style, enforced: tabs, `this.` on fields, properties and events, `var` everywhere, and pattern matching.
const OPINIONATED_FORMATTING: Record<string, Record<string, string>> = {
	'[*]': { charset: 'utf-8', end_of_line: 'lf', indent_style: 'tab', indent_size: '4', tab_width: '4', insert_final_newline: 'true', trim_trailing_whitespace: 'true' },
	// The .NET formatter doesn't wrap at this width; editors and MA0177 read it.
	'[*.cs]': { max_line_length: '200' },
	// YAML doesn't allow tabs.
	'[*.{yml,yaml}]': { indent_style: 'space', indent_size: '2' },
	'[*.md]': { trim_trailing_whitespace: 'false' },
	'[*.{cmd,bat}]': { end_of_line: 'crlf' }
};

const OPINIONATED_OPTIONS: Record<string, string> = {
	dotnet_separate_import_directive_groups: 'false',
	// A one-statement body may skip braces; IDE2001 keeps it on its own line.
	csharp_prefer_braces: 'when_multiline',
	dotnet_style_qualification_for_field: 'true',
	dotnet_style_qualification_for_property: 'true',
	dotnet_style_qualification_for_event: 'true',
	dotnet_style_qualification_for_method: 'false',
	csharp_style_var_for_built_in_types: 'true',
	csharp_style_var_when_type_is_apparent: 'true',
	csharp_style_var_elsewhere: 'true',
	csharp_style_pattern_matching_over_as_with_null_check: 'true',
	csharp_style_pattern_matching_over_is_with_cast_check: 'true',
	csharp_style_prefer_pattern_matching: 'true',
	csharp_style_prefer_not_pattern: 'true',
	csharp_style_prefer_null_check_over_type_check: 'true',
	dotnet_style_prefer_is_null_check_over_reference_equality_method: 'true',
	dotnet_style_allow_multiple_blank_lines_experimental: 'false',
	csharp_style_allow_embedded_statements_on_same_line_experimental: 'false',
	csharp_style_allow_blank_lines_between_consecutive_braces_experimental: 'false',
	dotnet_style_allow_statement_immediately_after_block_experimental: 'false',
	csharp_style_allow_blank_line_after_colon_in_constructor_initializer_experimental: 'false',
	csharp_style_allow_blank_line_after_token_in_conditional_expression_experimental: 'false',
	csharp_style_allow_blank_line_after_token_in_arrow_expression_clause_experimental: 'false'
};

const OPINIONATED_SEVERITIES: Record<string, Severity> = {
	// Trailing commas after the last value are left to taste.
	MA0007: 'none',
	// Namespaces needn't mirror folders; latest-recommended would otherwise warn.
	IDE0130: 'none',
	IDE0003: 'warning',
	IDE0009: 'warning',
	IDE0007: 'warning',
	IDE0008: 'none',
	IDE0049: 'warning',
	IDE0019: 'warning',
	IDE0020: 'warning',
	IDE0038: 'warning',
	IDE0041: 'warning',
	IDE0078: 'warning',
	IDE0083: 'warning',
	IDE0150: 'warning',
	IDE0260: 'warning',
	IDE0063: 'warning',
	IDE0090: 'warning',
	IDE0290: 'warning',
	IDE1006: 'warning',
	IDE0016: 'warning',
	IDE0029: 'warning',
	IDE0030: 'warning',
	IDE0270: 'warning',
	IDE0031: 'warning',
	IDE0054: 'warning',
	IDE0074: 'warning',
	IDE0056: 'warning',
	IDE0057: 'warning',
	IDE0066: 'warning',
	IDE0170: 'warning',
	IDE0340: 'warning',
	IDE0018: 'warning',
	IDE0034: 'warning',
	IDE0071: 'warning',
	IDE0075: 'warning',
	IDE0037: 'warning',
	IDE0039: 'warning',
	IDE0180: 'warning',
	IDE0350: 'warning',
	IDE0360: 'warning',
	IDE2000: 'warning',
	IDE2001: 'warning',
	IDE2002: 'warning',
	IDE2003: 'warning',
	IDE2004: 'warning',
	IDE2005: 'warning',
	IDE2006: 'warning',
	CA2016: 'error'
};

// Private fields read as `this.name`, so they need no underscore; private static readonly fields are PascalCase. There's no
// Async suffix rule, since VSTHRD200 already checks it.
const OPINIONATED_NAMING_SYMBOLS: readonly string[] = ['interfaces', 'type_parameters', 'types', 'members', 'constants', 'private_fields', 'parameters_and_locals'];
const PRIVATE_STATIC_READONLY_FIELDS: NamingRule = {
	symbols: 'private_static_readonly_fields',
	applicableKinds: ['field'],
	applicableAccessibilities: ['private'],
	requiredModifiers: ['static', 'readonly'],
	capitalization: 'pascal_case',
	requiredPrefix: '',
	requiredSuffix: '',
	wordSeparator: '',
	severity: 'warning'
};

const MEZIANTOU = 'Meziantou.Analyzer';
const BANNED_API = 'Microsoft.CodeAnalysis.BannedApiAnalyzers';
const SONAR = 'SonarAnalyzer.CSharp';
const VS_THREADING = 'Microsoft.VisualStudio.Threading.Analyzers';

// The threading analyzers' JoinableTaskFactory and main-thread rules only suit Visual Studio extensions and UI apps, and
// VSTHRD200's Async suffix is naming rather than async correctness, which only Opinionated enforces.
const VS_THREADING_OFF: Record<string, Severity> = Object.fromEntries(
	['VSTHRD001', 'VSTHRD003', 'VSTHRD004', 'VSTHRD010', 'VSTHRD011', 'VSTHRD012', 'VSTHRD108', 'VSTHRD109', 'VSTHRD115', 'VSTHRD200'].map(id => [id, 'none'])
);

/** What src can hold in a preset. Presets now set libraries; older ones could set apps and services, or no kind. */
export const SOURCE_KINDS: readonly (ProjectKind | undefined)[] = ['library', 'service', undefined];

// Culture rules services turn off, since they run with invariant globalization.
const SERVICE_CULTURE_RULES = ['MA0002', 'MA0076'];

/**
 * Builds a preset for an SDK band. From Recommended up it adds src for libraries and tests for test projects. Rules the
 * band doesn't have are left out, and duplicates of active rules are turned off, so no preset ships duplicate warnings.
 */
export function toPresetConfig(preset: Preset, catalog: Catalog): WizardConfig {
	return toPresetConfigWithSource(preset, 'library', catalog);
}

/**
 * A preset with src holding `sourceKind` projects, or no kind. Version 1 share links and older `.editorconfig` headers named
 * the preset with what src held, such as `Strict for libraries`, so this rebuilds them with the settings they had.
 */
export function toPresetConfigWithSource(preset: Preset, sourceKind: ProjectKind | undefined, catalog: Catalog): WizardConfig {
	const tfms = [`net${catalog.band.channel}`];
	// The repo root holds what every project shares; the kind of project belongs to src, beside tests.
	const root: ScopeConfig = { path: '', tfms, formatting: structuredClone(FORMATTING) };
	const config: WizardConfig = { versions: { sdkBand: catalog.band.band }, scopes: [root] };
	if (preset === 'microsoft-defaults') return config;

	root.options = { ...CONVENTION_OPTIONS };
	root.severities = { ...CONVENTION_SEVERITIES };
	root.naming = NAMING_TEMPLATES.filter(template => MICROSOFT_NAMING_SYMBOLS.includes(template.symbols)).map(template => structuredClone(template));
	root.build = { EnforceCodeStyleInBuild: 'true' };
	if (preset === 'microsoft-conventions') return withoutUnknownRules(config, catalog);

	root.severities = { ...root.severities, ...RECOMMENDED_SEVERITIES };
	// XML docs are generated for IDE0005 to run on build; outside libraries, missing docs aren't worth a warning.
	root.severities.CS1591 = 'none';
	root.categorySeverities = { Performance: 'warning', Security: 'error' };
	root.build = { ...root.build, ...RECOMMENDED_BUILD };
	root.ciBuild = { TreatWarningsAsErrors: 'true', RestoreLockedMode: 'true' };
	// Microsoft's analyzers only; Strict adds third-party ones for the gaps they fill.
	root.severities = { ...root.severities, ...VS_THREADING_OFF };
	root.packages = [BANNED_API, VS_THREADING];
	// Banned APIs every kind shares go at the root; ones for a single kind, such as Console in libraries, go with its projects.
	root.bannedApis = BANNED_API_SETS.filter(set => set.projectKinds === undefined).flatMap(set => set.apis);
	config.nuget = { sources: [{ ...NUGET_ORG, patterns: ['*'] }], auditSourceUrl: NUGET_ORG.url };
	config.globalJson = { rollForward: 'latestFeature', isTestingPlatformRunner: false, msbuildSdks: {} };

	if (preset === 'strict' || preset === 'opinionated') {
		root.categorySeverities.Performance = 'error';
		root.severities = { ...root.severities, ...STRICT_SEVERITIES, ...toWarnings(STRICT_ANALYZER_RULES), CA1848: 'error', CA2254: 'error', S3267: 'none' };
		root.build.TreatWarningsAsErrors = 'true';
		delete root.ciBuild.TreatWarningsAsErrors;
		root.packages = [...root.packages, MEZIANTOU, SONAR];
	}

	if (preset === 'opinionated') {
		root.formatting = structuredClone(OPINIONATED_FORMATTING);
		root.options = { ...root.options, ...OPINIONATED_OPTIONS };
		root.severities = { ...root.severities, ...OPINIONATED_SEVERITIES, ...toWarnings(OPINIONATED_ANALYZER_RULES) };
		// Catching general exceptions is allowed, so CA1031 stays at its default of off.
		delete root.severities.CA1031;
		// S134 caps nesting at its default of three levels; cognitive complexity is a backstop high enough that a long, flat
		// sequence of guarded steps passes.
		root.ruleParameters = { ...root.ruleParameters, S3776: { threshold: '25' } };
		root.naming = toOpinionatedNaming();
		root.build.UseArtifactsOutput = 'true';
		root.build.DebugType = 'embedded';
		// MSTest.Sdk runs on Microsoft.Testing.Platform, so dotnet test can use it directly. It ships with the MSTest analyzers
		// at the same version, so the catalog's version pins it for every test project.
		const msTestVersion = catalog.packages.get(MSTEST_PACKAGE)?.version;
		config.globalJson = { ...config.globalJson, isTestingPlatformRunner: true, msbuildSdks: msTestVersion ? { 'MSTest.Sdk': msTestVersion } : {} };
	}

	const src = toFolderDefaults('src', sourceKind, preset, config, catalog);
	const tests = toFolderDefaults('tests', 'test', preset, config, catalog);
	config.scopes.push(src, tests);
	return withoutDuplicateRules(withoutUnknownRules(config, catalog), catalog);
}

/**
 * What a folder holding `projectKind` projects starts with at a preset level, on top of what it inherits in `config`. Below
 * Recommended, only test folders get settings.
 */
export function toFolderDefaults(path: string, projectKind: ProjectKind | undefined, preset: Preset, config: WizardConfig, catalog: Catalog): ScopeConfig {
	const scope: ScopeConfig = { path, ...(projectKind ? { projectKind } : {}) };
	const inherited = resolveInheritedScope(config, scope);
	const defaults = projectKind === 'test' ? toTestDefaults(scope, preset, inherited, catalog) : toShippedDefaults(scope, preset, inherited);
	// A folder inside a library or service folder would otherwise build like one.
	if (projectKind !== 'library') removeLibrarySettings(defaults, inherited);
	if (projectKind !== 'service') removeServiceSettings(defaults, inherited, config, catalog);
	return withoutRepeatedSettings(defaults, inherited);
}

/** A folder's defaults cleaned up the way presets are: rules the band doesn't have left out, and duplicates turned off. */
export function toFolderSettings(path: string, projectKind: ProjectKind | undefined, preset: Preset, config: WizardConfig, catalog: Catalog): ScopeConfig {
	const scope = toFolderDefaults(path, projectKind, preset, config, catalog);
	const withScope: WizardConfig = { ...config, scopes: [...config.scopes.filter(other => other.path !== path), scope] };
	dropUnknownRules(scope, catalog);
	turnOffDuplicateRules(scope, withScope, catalog);
	return scope;
}

export function withoutInherited<TValue>(own: Record<string, TValue>, inherited: Record<string, TValue>): Record<string, TValue> {
	return Object.fromEntries(Object.entries(own).filter(([key, value]) => inherited[key] !== value));
}

/**
 * Libraries track public API, ConfigureAwait and docs, and pack; apps get ASP.NET Core bans. A folder of no kind gets only
 * what both share, such as Opinionated's trimming and AOT analyzers.
 */
function toShippedDefaults(scope: ScopeConfig, preset: Preset, inherited: ResolvedScope | undefined): ScopeConfig {
	if (preset === 'microsoft-defaults' || preset === 'microsoft-conventions') return scope;

	const projectKind = scope.projectKind;
	const kindBannedApis = BANNED_API_SETS.filter(set => projectKind && set.projectKinds?.includes(projectKind)).flatMap(set => set.apis);
	if (kindBannedApis.length > 0) scope.bannedApis = kindBannedApis;
	if (projectKind === 'library') {
		scope.severities = { CA2007: 'warning', CS1591: 'warning' };
		// Embedded symbols ship inside the package with every source file, so debugging needs no symbol package or access
		// to the repo, which suits private packages.
		const { IncludeSymbols: _includeSymbols, SymbolPackageFormat: _symbolPackageFormat, EmbedUntrackedSources: _embedUntrackedSources, ...embeddedLibraryBuild } = LIBRARY_BUILD;
		scope.build = inherited?.build.DebugType === 'embedded' ? { ...embeddedLibraryBuild, EmbedAllSources: 'true' } : { ...LIBRARY_BUILD };
		scope.packages = [...new Set([...(inherited?.packages ?? []), PUBLIC_API_PACKAGE])];
	}

	// Apps that don't format for people run fine without ICU, and behave the same in every locale and container.
	if (projectKind === 'service' && preset === 'opinionated') scope.build = { InvariantGlobalization: 'true' };

	// Libraries can't rely on the app's culture, so string interpolation and sorting must name theirs too. Services run with
	// invariant globalization, where neither can vary.
	if (preset === 'opinionated' && projectKind === 'library') scope.severities = { ...scope.severities, MA0076: 'warning' };
	if (preset === 'opinionated' && projectKind === 'service') scope.severities = { ...scope.severities, ...Object.fromEntries(SERVICE_CULTURE_RULES.map(id => [id, 'none'])) };

	if (preset === 'opinionated') {
		scope.areInternalsVisibleToTests = true;
		// Opinionated shows what would block trimming and Native AOT without claiming compatibility: the analyzers run, their
		// findings are suggestions so they never fail the build, and libraries don't declare IsAotCompatible.
		const { IsAotCompatible: _isAotCompatible, ...build } = scope.build ?? {};
		scope.build = { ...build, EnableTrimAnalyzer: 'true', EnableAotAnalyzer: 'true' };
		scope.categorySeverities = { Trimming: 'suggestion', AOT: 'suggestion' };
	}

	return scope;
}

/**
 * Tests don't ship, so they aren't packed and don't need ConfigureAwait (CA2007) or XML docs (CS1591). They also allow
 * underscores in test names (CA1707) and public test classes (CA1515).
 */
function toTestDefaults(scope: ScopeConfig, preset: Preset, inherited: ResolvedScope | undefined, catalog: Catalog): ScopeConfig {
	scope.severities = { CA1707: 'none', CA2007: 'none', CA1515: 'none', CS1591: 'none' };
	scope.build = { IsPackable: 'false' };
	if (preset !== 'opinionated') return scope;

	// Opinionated test projects reference what they test by name, so their project files hold only what's specific to them.
	scope.isProjectUnderTestReferenced = true;
	// Opinionated tests use MSTest, whose analyzers come with MSTest.Sdk; its suggestions become warnings.
	scope.packages = [...new Set([...(inherited?.packages ?? []), MSTEST_PACKAGE])];
	const msTestSuggestions = catalog.rules
		.values()
		.filter(rule => rule.packageId === MSTEST_PACKAGE && rule.isEnabledByDefault && rule.defaultSeverity === 'suggestion')
		.map(rule => rule.id)
		.toArray();
	scope.severities = { ...scope.severities, ...toWarnings(msTestSuggestions) };
	return scope;
}

function removeLibrarySettings(scope: ScopeConfig, inherited: ResolvedScope | undefined): void {
	if (!inherited) return;

	const build: Record<string, string> = {};
	if (inherited.build.IsPackable === 'true') build.IsPackable = 'false';
	if (inherited.build.IsAotCompatible === 'true') build.IsAotCompatible = 'false';
	const severities: Record<string, Severity> = Object.fromEntries(['CA2007', 'CS1591'].filter(id => inherited.severities[id] === 'warning').map(id => [id, 'none']));
	scope.build = { ...build, ...scope.build };
	scope.severities = { ...severities, ...scope.severities };
	const packages = scope.packages ?? inherited.packages;
	if (packages.includes(PUBLIC_API_PACKAGE)) scope.packages = packages.filter(packageId => packageId !== PUBLIC_API_PACKAGE);
}

/** Turns globalization back on, and the culture rules back to what the repo root gives them. */
function removeServiceSettings(scope: ScopeConfig, inherited: ResolvedScope | undefined, config: WizardConfig, catalog: Catalog): void {
	if (!inherited) return;

	if (inherited.build.InvariantGlobalization === 'true') scope.build = { InvariantGlobalization: 'false', ...scope.build };
	const root = resolveScope(config, config.scopes[0]);
	for (const rule of SERVICE_CULTURE_RULES.map(id => catalog.rules.get(id))) {
		if (!rule || inherited.severities[rule.id] !== 'none' || scope.severities?.[rule.id] !== undefined) continue;
		scope.severities = { ...scope.severities, [rule.id]: getEffectiveSeverity(rule, root, catalog) };
	}
}

/** Leaves out what the folder would inherit anyway, so its files hold only what it changes. */
function withoutRepeatedSettings(scope: ScopeConfig, inherited: ResolvedScope | undefined): ScopeConfig {
	const { severities, build, categorySeverities, bannedApis, packages, ...rest } = scope;
	const own: ScopeConfig = {
		...rest,
		severities: withoutInherited(severities ?? {}, inherited?.severities ?? {}),
		build: withoutInherited(build ?? {}, inherited?.build ?? {}),
		categorySeverities: withoutInherited(categorySeverities ?? {}, inherited?.categorySeverities ?? {}),
		bannedApis: (bannedApis ?? []).filter(api => !inherited?.bannedApis.some(inheritedApi => inheritedApi.symbol === api.symbol))
	};
	if (packages !== undefined && !(inherited && isSameList(packages, inherited.packages))) own.packages = packages;
	if (own.areInternalsVisibleToTests === inherited?.areInternalsVisibleToTests) delete own.areInternalsVisibleToTests;
	if (own.isProjectUnderTestReferenced === inherited?.isProjectUnderTestReferenced) delete own.isProjectUnderTestReferenced;
	return Object.fromEntries(Object.entries(own).filter(([, value]) => !isEmpty(value))) as ScopeConfig;
}

/** Whether a setting holds nothing: an empty list or object. */
export function isEmpty(value: unknown): boolean {
	if (Array.isArray(value)) return value.length === 0;
	return typeof value === 'object' && value !== null && Object.keys(value).length === 0;
}

function toWarnings(ruleIds: readonly string[]): Record<string, Severity> {
	return Object.fromEntries(ruleIds.map(id => [id, 'warning']));
}

/** Naming for the opinionated style, with private static readonly fields matched before other private fields. */
function toOpinionatedNaming(): NamingRule[] {
	const templates = NAMING_TEMPLATES.filter(template => OPINIONATED_NAMING_SYMBOLS.includes(template.symbols)).map(template => structuredClone(template));
	const privateFieldsIndex = templates.findIndex(template => template.symbols === 'private_fields');
	return templates.toSpliced(privateFieldsIndex, 0, structuredClone(PRIVATE_STATIC_READONLY_FIELDS));
}

/** Drops severities for rules the band doesn't have, such as CA1873 before SDK 10. */
function withoutUnknownRules(config: WizardConfig, catalog: Catalog): WizardConfig {
	for (const scope of config.scopes) dropUnknownRules(scope, catalog);
	return config;
}

function dropUnknownRules(scope: ScopeConfig, catalog: Catalog): void {
	if (scope.severities) scope.severities = Object.fromEntries(Object.entries(scope.severities).filter(([id]) => catalog.rules.has(id)));
}

/** Turns off every duplicate the overlap map finds, scope by scope, keeping each concern's owner. */
function withoutDuplicateRules(config: WizardConfig, catalog: Catalog): WizardConfig {
	for (const scope of config.scopes) turnOffDuplicateRules(scope, config, catalog);
	return config;
}

function turnOffDuplicateRules(scope: ScopeConfig, config: WizardConfig, catalog: Catalog): void {
	const resolved = resolveScope(config, scope);
	const overlaps = findActiveOverlaps(catalog, rule => (!rule.packageId || resolved.packages.includes(rule.packageId)) && isReported(getEffectiveSeverity(rule, resolved, catalog)));
	for (const duplicate of overlaps.flatMap(overlap => overlap.duplicates)) {
		scope.severities ??= {};
		scope.severities[duplicate.id] = 'none';
	}
}
