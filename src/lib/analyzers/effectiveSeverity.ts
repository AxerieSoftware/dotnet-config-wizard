import type { Catalog, CatalogRule } from '../catalog/catalog.ts';
import type { ResolvedScope } from '../config/scopes.ts';
import type { Severity } from '../config/wizardConfig.ts';
import { parseAnalysisLevel } from './analysisLevel.ts';

const NET_ANALYZERS_SOURCE = 'Microsoft.CodeAnalysis.NetAnalyzers';
const COMPILER_SOURCE = 'Microsoft.CodeAnalysis.CSharp';

/**
 * The severity a rule ends up with in a scope: what the scope configures for the rule, then for its category, otherwise
 * what the SDK does by default. Category severities don't reach compiler warnings, which aren't analyzers. CA rules
 * follow the AnalysisLevel files for the scope's level and mode where they list the rule, warning-wave compiler warnings turn on at their level, and
 * package rules only run when the scope references the package.
 */
export function getEffectiveSeverity(rule: CatalogRule, scope: ResolvedScope, catalog: Catalog): Severity {
	const configured = scope.severities[rule.id];
	if (configured) return configured;
	if (rule.packageId && !scope.packages.includes(rule.packageId)) return 'none';

	const categorySeverity = rule.source === COMPILER_SOURCE ? undefined : scope.categorySeverities[rule.category];
	if (categorySeverity) return categorySeverity;

	const { level, mode } = parseAnalysisLevel(scope.build.AnalysisLevel, catalog.band);
	const analysisLevelSeverity = rule.source === NET_ANALYZERS_SOURCE ? (catalog.analysisLevels[level]?.[mode]?.[rule.id] as Severity | undefined) : undefined;
	if (analysisLevelSeverity) return analysisLevelSeverity;
	if (rule.source === COMPILER_SOURCE) return (rule.warningLevel ?? 0) <= Number(level) ? 'warning' : 'none';

	return rule.isEnabledByDefault ? (rule.defaultSeverity as Severity) : 'none';
}

/** Whether a severity reports anything in the editor or build. Silent rules only offer refactorings. */
export function isReported(severity: Severity): boolean {
	return severity === 'suggestion' || severity === 'warning' || severity === 'error';
}
