import type { BannedApi } from '../analyzers/bannedApis.ts';
import type { NamingRule } from '../naming/namingRule.ts';
import type { ProjectKind, ScopeConfig, Severity, WizardConfig } from './wizardConfig.ts';

/** A scope's effective settings: its own values on top of everything it inherits. */
export type ResolvedScope = {
	path: string;
	projectKind: ProjectKind | undefined;
	tfms: string[];
	formatting: Record<string, Record<string, string>>;
	options: Record<string, string>;
	severities: Record<string, Severity>;
	categorySeverities: Record<string, Severity>;
	build: Record<string, string>;
	ciBuild: Record<string, string>;
	naming: NamingRule[];
	packages: string[];
	ruleParameters: Record<string, Record<string, string>>;
	bannedApis: BannedApi[];
	isTargetFrameworkShared: boolean;
	areInternalsVisibleToTests: boolean;
	isProjectUnderTestReferenced: boolean;
};

/** The closest scope whose folder contains this one; the root scope contains every other scope. */
export function getParentScope(config: WizardConfig, scope: ScopeConfig): ScopeConfig | undefined {
	if (scope.path === '') return undefined;
	return findScopeForFolder(config, scope.path.split('/').slice(0, -1).join('/'));
}

/** The scope whose folder holds a repo folder, such as `src/Billing`: the closest one, or the root scope. */
export function findScopeForFolder(config: WizardConfig, folderPath: string): ScopeConfig {
	return config.scopes
		.filter(scope => scope.path === '' || folderPath === scope.path || folderPath.startsWith(`${scope.path}/`))
		.reduce((closest, scope) => (scope.path.length > closest.path.length ? scope : closest), config.scopes[0]);
}

/** What a scope inherits from the folders above it, or undefined for the root scope. */
export function resolveInheritedScope(config: WizardConfig, scope: ScopeConfig): ResolvedScope | undefined {
	const parent = getParentScope(config, scope);
	return parent ? resolveScope(config, parent) : undefined;
}

export function resolveScope(config: WizardConfig, scope: ScopeConfig): ResolvedScope {
	const inherited = resolveInheritedScope(config, scope);

	return {
		path: scope.path,
		projectKind: scope.projectKind ?? inherited?.projectKind,
		tfms: scope.tfms ?? inherited?.tfms ?? [],
		formatting: mergeNested(inherited?.formatting ?? {}, scope.formatting ?? {}),
		options: { ...inherited?.options, ...scope.options },
		severities: { ...inherited?.severities, ...scope.severities },
		categorySeverities: { ...inherited?.categorySeverities, ...scope.categorySeverities },
		build: { ...inherited?.build, ...scope.build },
		ciBuild: { ...inherited?.ciBuild, ...scope.ciBuild },
		naming: mergeNaming(inherited?.naming ?? [], scope.naming ?? []),
		packages: scope.packages ?? inherited?.packages ?? [],
		ruleParameters: mergeNested(inherited?.ruleParameters ?? {}, scope.ruleParameters ?? {}),
		bannedApis: [...(inherited?.bannedApis ?? []), ...(scope.bannedApis ?? [])],
		isTargetFrameworkShared: scope.isTargetFrameworkShared ?? inherited?.isTargetFrameworkShared ?? false,
		areInternalsVisibleToTests: scope.areInternalsVisibleToTests ?? inherited?.areInternalsVisibleToTests ?? false,
		isProjectUnderTestReferenced: scope.isProjectUnderTestReferenced ?? inherited?.isProjectUnderTestReferenced ?? false
	};
}

/** Merges two levels of keyed settings, such as formatting by glob or parameters by rule, one key at a time. */
function mergeNested(inherited: Record<string, Record<string, string>>, own: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
	const merged = { ...inherited };
	for (const [glob, settings] of Object.entries(own)) merged[glob] = { ...merged[glob], ...settings };
	return merged;
}

/** A nested scope's rule replaces the inherited rule for the same symbol group. */
function mergeNaming(inherited: NamingRule[], own: NamingRule[]): NamingRule[] {
	const ownSymbols = new Set(own.map(rule => rule.symbols));
	return [...inherited.filter(rule => !ownSymbols.has(rule.symbols)), ...own];
}
