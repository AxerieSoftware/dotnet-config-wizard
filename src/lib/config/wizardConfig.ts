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
	/** MSBuild property name to value. */
	build?: Record<string, string>;
	naming?: NamingRule[];
};

export type WizardConfig = {
	/** `langVersion` is null for the target framework's default, `latest`, or a version such as `12.0`. */
	versions: { sdkBand: string; langVersion: string | null };
	scopes: ScopeConfig[];
};

export type ParseResult = { status: 'valid'; config: WizardConfig } | { status: 'invalid'; reason: string };

/** Checks data from outside the app, such as a JSON file, before anything trusts its shape. */
export function parseWizardConfig(value: unknown): ParseResult {
	if (!isRecord(value)) return invalid('The config must be a JSON object.');
	if (!isRecord(value.versions) || typeof value.versions.sdkBand !== 'string') return invalid('versions.sdkBand must be a string.');
	if (value.versions.langVersion !== null && typeof value.versions.langVersion !== 'string') return invalid('versions.langVersion must be a string or null.');
	if (!Array.isArray(value.scopes) || value.scopes.length === 0) return invalid('scopes must be a non-empty array.');

	for (const [index, scope] of value.scopes.entries()) {
		const reason = findScopeProblem(scope);
		if (reason) return invalid(`scopes[${index}]: ${reason}`);
	}

	if (value.scopes[0].path !== '') return invalid('The first scope must be the root scope, with an empty path.');

	return { status: 'valid', config: value as WizardConfig };
}

/** Returns the root scope, which every config has. */
export function getRootScope(config: WizardConfig): ScopeConfig {
	return config.scopes[0];
}

function findScopeProblem(scope: unknown): string | undefined {
	if (!isRecord(scope)) return 'must be an object.';
	if (typeof scope.path !== 'string') return 'path must be a string.';
	if (scope.projectKind !== undefined && !PROJECT_KINDS.includes(scope.projectKind as ProjectKind)) return `projectKind must be one of ${PROJECT_KINDS.join(', ')}.`;
	if (scope.tfms !== undefined && !isStringArray(scope.tfms)) return 'tfms must be an array of strings.';
	if (scope.formatting !== undefined && !(isRecord(scope.formatting) && Object.values(scope.formatting).every(isStringRecord))) return 'formatting must map globs to string key/value objects.';
	if (scope.options !== undefined && !isStringRecord(scope.options)) return 'options must map names to strings.';
	if (scope.build !== undefined && !isStringRecord(scope.build)) return 'build must map property names to strings.';
	if (scope.severities !== undefined && !(isRecord(scope.severities) && Object.values(scope.severities).every(severity => SEVERITIES.includes(severity as Severity))))
		return `severities must map rule IDs to one of ${SEVERITIES.join(', ')}.`;
	if (scope.naming !== undefined && !(Array.isArray(scope.naming) && scope.naming.every(isNamingRule))) return 'naming must be an array of naming rules.';

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
