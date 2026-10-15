import type { BannedApi } from '../analyzers/bannedApis.ts';
import { CAPITALIZATIONS, type Capitalization, type NamingRule } from '../naming/namingRule.ts';

export const SEVERITIES = ['none', 'silent', 'suggestion', 'warning', 'error'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const PROJECT_KINDS = ['library', 'service', 'test'] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

/** Settings for one folder. The root scope has an empty path; other scopes hold only what they override. */
export type ScopeConfig = {
	path: string;
	projectKind?: ProjectKind;
	tfms?: string[];
	/** EditorConfig section glob, such as `[*.md]`, to key/value pairs. */
	formatting?: Record<string, Record<string, string>>;
	/** Code-style option name to value, written to the C# section. */
	options?: Record<string, string>;
	/** Rule ID to severity, written as `dotnet_diagnostic.<ID>.severity`. */
	severities?: Record<string, Severity>;
	/** Rule category, such as `Security`, to the severity of every analyzer rule in it that doesn't set its own. */
	categorySeverities?: Record<string, Severity>;
	/** MSBuild property name to value. */
	build?: Record<string, string>;
	/** MSBuild properties that only apply to CI builds, such as TreatWarningsAsErrors. */
	ciBuild?: Record<string, string>;
	naming?: NamingRule[];
	/** Analyzer package IDs this scope's projects reference; a nested scope's list replaces its parent's. */
	packages?: string[];
	/** Rule ID to parameter values for analyzers that read them from an additional file, such as Sonar's `SonarLint.xml`. */
	ruleParameters?: Record<string, Record<string, string>>;
	/** Entries for this scope's `BannedSymbols.txt`, added to the ones it inherits. */
	bannedApis?: BannedApi[];
	/** Whether analyzers skip this folder's C# as if it were generated, such as for legacy code nobody maintains. */
	isIgnored?: boolean;
	/** Whether this folder's Directory.Build.props sets the target frameworks for every project in it. */
	isTargetFrameworkShared?: boolean;
	/** A prefix the repo root adds to every project's assembly name and root namespace, such as `Contoso`. */
	projectNamePrefix?: string;
	/** Whether each project's internal types are visible to its test project, named `<project>.Tests`. */
	areInternalsVisibleToTests?: boolean;
};

export type NuGetSource = { key: string; url: string; patterns: string[] };

/** A `nuget.config` that clears inherited sources and maps every package to one source. */
export type NuGetConfig = { sources: NuGetSource[]; auditSourceUrl: string };

export const ROLL_FORWARD_POLICIES = ['latestFeature', 'latestPatch', 'latestMajor', 'disable'] as const;

/** A `global.json`; the SDK version always comes from the selected band. */
export type GlobalJsonConfig = { rollForward: (typeof ROLL_FORWARD_POLICIES)[number]; isTestingPlatformRunner: boolean; msbuildSdks: Record<string, string> };

export type WizardConfig = {
	/** The C# version always comes from each scope's target frameworks; the wizard never sets LangVersion. */
	versions: { sdkBand: string };
	scopes: ScopeConfig[];
	nuget?: NuGetConfig;
	globalJson?: GlobalJsonConfig;
	/** Where the root scope's rule severities go: `.editorconfig` by default, or a global AnalyzerConfig file. */
	severityFile?: 'editorconfig' | 'globalconfig';
};

export type ParseResult = { status: 'valid'; config: WizardConfig } | { status: 'invalid'; reason: string };

/** Checks data from outside the app, such as a JSON file, before anything trusts its shape. */
export function parseWizardConfig(value: unknown): ParseResult {
	if (!isRecord(value)) return invalid('The config must be a JSON object.');
	if (!isRecord(value.versions) || typeof value.versions.sdkBand !== 'string') return invalid('versions.sdkBand must be a string.');
	if (!Array.isArray(value.scopes) || value.scopes.length === 0) return invalid('scopes must be a non-empty array.');

	for (const [index, scope] of value.scopes.entries()) {
		const reason = findScopeProblem(scope);
		if (reason) return invalid(`scopes[${index}]: ${reason}`);
	}

	if (value.scopes[0].path !== '') return invalid('The first scope must be the root scope, with an empty path.');
	if (value.nuget !== undefined && !isNuGetConfig(value.nuget)) return invalid('nuget must have sources and an auditSourceUrl.');
	if (value.globalJson !== undefined && !isGlobalJsonConfig(value.globalJson)) return invalid('globalJson must have rollForward, isTestingPlatformRunner and msbuildSdks.');
	if (value.severityFile !== undefined && value.severityFile !== 'editorconfig' && value.severityFile !== 'globalconfig') return invalid('severityFile must be editorconfig or globalconfig.');

	return { status: 'valid', config: value as WizardConfig };
}

function findScopeProblem(scope: unknown): string | undefined {
	if (!isRecord(scope)) return 'must be an object.';
	if (typeof scope.path !== 'string') return 'path must be a string.';
	if (scope.projectKind !== undefined && !PROJECT_KINDS.includes(scope.projectKind as ProjectKind)) return `projectKind must be one of ${PROJECT_KINDS.join(', ')}.`;
	if (scope.tfms !== undefined && !isStringArray(scope.tfms)) return 'tfms must be an array of strings.';
	if (scope.formatting !== undefined && !(isRecord(scope.formatting) && Object.values(scope.formatting).every(isStringRecord))) return 'formatting must map globs to string key/value objects.';
	if (scope.options !== undefined && !isStringRecord(scope.options)) return 'options must map names to strings.';
	if (scope.build !== undefined && !isStringRecord(scope.build)) return 'build must map property names to strings.';
	if (scope.ciBuild !== undefined && !isStringRecord(scope.ciBuild)) return 'ciBuild must map property names to strings.';
	if (scope.severities !== undefined && !(isRecord(scope.severities) && Object.values(scope.severities).every(severity => SEVERITIES.includes(severity as Severity))))
		return `severities must map rule IDs to one of ${SEVERITIES.join(', ')}.`;
	if (scope.categorySeverities !== undefined && !(isRecord(scope.categorySeverities) && Object.values(scope.categorySeverities).every(severity => SEVERITIES.includes(severity as Severity))))
		return `categorySeverities must map categories to one of ${SEVERITIES.join(', ')}.`;
	if (scope.naming !== undefined && !(Array.isArray(scope.naming) && scope.naming.every(isNamingRule))) return 'naming must be an array of naming rules.';
	if (scope.packages !== undefined && !isStringArray(scope.packages)) return 'packages must be an array of package IDs.';
	if (scope.ruleParameters !== undefined && !(isRecord(scope.ruleParameters) && Object.values(scope.ruleParameters).every(isStringRecord)))
		return 'ruleParameters must map rule IDs to string key/value objects.';
	if (scope.bannedApis !== undefined && !(Array.isArray(scope.bannedApis) && scope.bannedApis.every(api => isRecord(api) && typeof api.symbol === 'string' && typeof api.message === 'string')))
		return 'bannedApis must be an array of { symbol, message } objects.';
	if (scope.isIgnored !== undefined && typeof scope.isIgnored !== 'boolean') return 'isIgnored must be true or false.';
	if (scope.isTargetFrameworkShared !== undefined && typeof scope.isTargetFrameworkShared !== 'boolean') return 'isTargetFrameworkShared must be true or false.';
	if (scope.projectNamePrefix !== undefined && typeof scope.projectNamePrefix !== 'string') return 'projectNamePrefix must be a string.';
	if (scope.areInternalsVisibleToTests !== undefined && typeof scope.areInternalsVisibleToTests !== 'boolean') return 'areInternalsVisibleToTests must be true or false.';

	return undefined;
}

function isNamingRule(value: unknown): value is NamingRule {
	return (
		isRecord(value) &&
		typeof value.symbols === 'string' &&
		/^\w+$/.test(value.symbols) &&
		isStringArray(value.applicableKinds) &&
		isStringArray(value.applicableAccessibilities) &&
		isStringArray(value.requiredModifiers) &&
		CAPITALIZATIONS.includes(value.capitalization as Capitalization) &&
		typeof value.requiredPrefix === 'string' &&
		typeof value.requiredSuffix === 'string' &&
		typeof value.wordSeparator === 'string' &&
		SEVERITIES.includes(value.severity as Severity)
	);
}

function isNuGetConfig(value: unknown): value is NuGetConfig {
	return (
		isRecord(value) &&
		typeof value.auditSourceUrl === 'string' &&
		Array.isArray(value.sources) &&
		value.sources.every(source => isRecord(source) && typeof source.key === 'string' && typeof source.url === 'string' && isStringArray(source.patterns))
	);
}

function isGlobalJsonConfig(value: unknown): value is GlobalJsonConfig {
	return (
		isRecord(value) && ROLL_FORWARD_POLICIES.includes(value.rollForward as GlobalJsonConfig['rollForward']) && typeof value.isTestingPlatformRunner === 'boolean' && isStringRecord(value.msbuildSdks)
	);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function invalid(reason: string): ParseResult {
	return { status: 'invalid', reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
	return isRecord(value) && Object.values(value).every(entry => typeof entry === 'string');
}
