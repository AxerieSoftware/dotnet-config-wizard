import { parseAnalysisLevel } from '../analyzers/analysisLevel.ts';
import { getEffectiveSeverity, isReported } from '../analyzers/effectiveSeverity.ts';
import { findActiveOverlaps } from '../analyzers/overlaps.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { getParentScope, type ResolvedScope, resolveScope } from '../config/scopes.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import type { SkippedKey } from '../export/generatedFile.ts';

export type IssueSeverity = 'error' | 'warning' | 'info';

/** A problem with a config: errors break builds, warnings are likely mistakes, and info notes things to know. */
export type ValidationIssue = { severity: IssueSeverity; scopePath: string; message: string };

type ScopeCheck = (context: { config: WizardConfig; scope: ScopeConfig; resolved: ResolvedScope; catalog: Catalog }) => Omit<ValidationIssue, 'scopePath'>[];

const NUGET_AUDIT_WARNINGS = ['NU1901', 'NU1902', 'NU1903', 'NU1904'];
const AZURE_ARTIFACTS_HOST = 'pkgs.dev.azure.com';

/** Checks a config and its generated output for combinations that break builds or don't do what they look like. */
export function validateConfig(config: WizardConfig, catalog: Catalog, skippedKeys: readonly (SkippedKey & { scopePath: string })[]): ValidationIssue[] {
	const issues: ValidationIssue[] = skippedKeys.map(skipped => ({ severity: 'warning', scopePath: skipped.scopePath, message: `${skipped.key} is left out of the files: ${skipped.reason}.` }));

	for (const scope of config.scopes) {
		const resolved = resolveScope(config, scope);
		for (const check of SCOPE_CHECKS) issues.push(...check({ config, scope, resolved, catalog }).map(issue => ({ ...issue, scopePath: scope.path })));
	}

	issues.push(...checkNuGetConfig(config));
	return issues;
}

const SCOPE_CHECKS: readonly ScopeCheck[] = [
	({ scope, resolved }) => {
		const hasLockedMode = resolved.build.RestoreLockedMode === 'true' || resolved.ciBuild.RestoreLockedMode === 'true';
		const isSetHere = scope.build?.RestoreLockedMode !== undefined || scope.ciBuild?.RestoreLockedMode !== undefined;
		if (!isSetHere || !hasLockedMode) return [];
		if (resolved.build.RestorePackagesWithLockFile !== 'true')
			return [{ severity: 'error', message: 'RestoreLockedMode needs RestorePackagesWithLockFile; without lock files every locked restore fails.' }];
		if (resolved.build.RestoreLockedMode === 'true')
			return [{ severity: 'warning', message: 'RestoreLockedMode applies to every build, so adding a package locally fails until packages.lock.json is updated. Limit it to CI builds.' }];
		return [];
	},
	({ resolved, catalog }) => {
		const ide0005 = catalog.rules.get('IDE0005');
		if (resolved.build.GenerateDocumentationFile !== 'false' || !ide0005 || !isReported(getEffectiveSeverity(ide0005, resolved, catalog))) return [];
		return [{ severity: 'error', message: 'IDE0005 can only run on build when GenerateDocumentationFile is true.' }];
	},
	({ scope, resolved, catalog }) => {
		if (resolved.build.EnforceCodeStyleInBuild === 'true') return [];
		const ideRuleIds = Object.entries(scope.severities ?? {})
			.filter(([id, severity]) => id.startsWith('IDE') && catalog.rules.get(id)?.isEnforcedOnBuild && (severity === 'warning' || severity === 'error'))
			.map(([id]) => id);
		if (ideRuleIds.length === 0) return [];
		return [{ severity: 'warning', message: `${ideRuleIds.join(', ')} only show in the editor until EnforceCodeStyleInBuild is true, so they won't fail a build.` }];
	},
	({ resolved, catalog }) => {
		const ca2007 = catalog.rules.get('CA2007');
		if (resolved.projectKind === 'library' || !resolved.projectKind || !ca2007 || !isReported(getEffectiveSeverity(ca2007, resolved, catalog))) return [];
		return [{ severity: 'warning', message: `CA2007 (ConfigureAwait) only helps libraries; ${resolved.projectKind} projects have no synchronization context to avoid.` }];
	},
	({ resolved }) => {
		if (resolved.build.IsAotCompatible !== 'true' || resolved.projectKind === 'library' || !resolved.projectKind) return [];
		return [
			{ severity: 'warning', message: `IsAotCompatible marks libraries; for ${resolved.projectKind} projects use PublishAot, or EnableAotAnalyzer to analyze without publishing as Native AOT.` }
		];
	},
	({ scope }) => {
		if (!/DateTime|\$\(\[/.test(scope.build?.Copyright ?? '')) return [];
		return [{ severity: 'warning', message: 'A computed Copyright changes every year, which breaks reproducible builds. Write the year in.' }];
	},
	({ resolved, catalog }) => {
		const { mode } = parseAnalysisLevel(resolved.build.AnalysisLevel, catalog.band);
		const isWarningsAsErrors = resolved.build.TreatWarningsAsErrors === 'true' || resolved.ciBuild.TreatWarningsAsErrors === 'true';
		const issues: Omit<ValidationIssue, 'scopePath'>[] = [];
		if (isWarningsAsErrors && mode === 'all')
			issues.push({ severity: 'warning', message: 'TreatWarningsAsErrors with AnalysisMode all turns hundreds of opinionated rules into build errors. Use recommended, or raise specific rules.' });

		const warningsNotAsErrors = (resolved.build.WarningsNotAsErrors ?? '').split(';');
		if (!isWarningsAsErrors || resolved.build.NuGetAudit === 'false' || NUGET_AUDIT_WARNINGS.every(id => warningsNotAsErrors.includes(id))) return issues;
		issues.push({
			severity: 'info',
			message: `With TreatWarningsAsErrors, a newly published advisory fails restore. Add ${NUGET_AUDIT_WARNINGS.join(';')} to WarningsNotAsErrors to keep audit findings as warnings.`
		});
		return issues;
	},
	({ config, scope }) => {
		if (scope.build?.IncludeSymbols !== 'true' || !config.nuget?.sources.some(source => source.url.includes(AZURE_ARTIFACTS_HOST))) return [];
		return [{ severity: 'warning', message: "Azure Artifacts doesn't host .snupkg symbol packages; publish symbols to the Azure Artifacts symbol server instead." }];
	},
	({ scope }) => [
		...(scope.build?.PackageValidationBaselineVersion
			? [{ severity: 'info' as const, message: `Restore downloads ${scope.build.PackageValidationBaselineVersion} of each package for package validation, so that version must already be published.` }]
			: []),
		...[scope.build?.PackageReadmeFile, scope.build?.PackageIcon]
			.filter(fileName => fileName !== undefined)
			.map(fileName => ({ severity: 'info' as const, message: `${fileName} must exist in ${scope.path === '' ? 'the repo root' : `${scope.path}/`} for packing to succeed.` }))
	],
	({ resolved, catalog }) =>
		findActiveOverlaps(catalog, rule => (!rule.packageId || resolved.packages.includes(rule.packageId)) && isReported(getEffectiveSeverity(rule, resolved, catalog))).map(overlap => ({
			severity: 'warning',
			message: `${overlap.concern} is checked by ${[overlap.owner, ...overlap.duplicates].map(rule => rule.id).join(', ')}; each problem would be reported more than once. Turn off the duplicates on the Analyzers step.`
		})),
	({ config, scope }) => {
		const parent = getParentScope(config, scope);
		if (!parent) return [];

		const inherited = resolveScope(config, parent);
		const repeated = [
			...Object.entries(scope.options ?? {})
				.filter(([name, value]) => inherited.options[name] === value)
				.map(([name]) => name),
			...Object.entries(scope.severities ?? {})
				.filter(([id, severity]) => inherited.severities[id] === severity)
				.map(([id]) => id),
			...Object.entries(scope.build ?? {})
				.filter(([name, value]) => inherited.build[name] === value)
				.map(([name]) => name),
			...Object.entries(scope.formatting ?? {}).flatMap(([glob, settings]) =>
				Object.entries(settings)
					.filter(([key, value]) => inherited.formatting[glob]?.[key] === value)
					.map(([key]) => `${glob} ${key}`)
			)
		];
		if (repeated.length === 0) return [];
		return [{ severity: 'info', message: `${repeated.join(', ')} repeat what this folder already inherits and can be removed.` }];
	}
];

function checkNuGetConfig(config: WizardConfig): ValidationIssue[] {
	if (!config.nuget) return [];

	const issues: ValidationIssue[] = config.nuget.sources
		.filter(source => source.patterns.length === 0)
		.map(source => ({ severity: 'error', scopePath: '', message: `NuGet source ${source.key} has no package patterns, so package source mapping never uses it.` }));
	const catchAllSources = config.nuget.sources.filter(source => source.patterns.includes('*'));
	if (catchAllSources.length > 1)
		issues.push({
			severity: 'warning',
			scopePath: '',
			message: `${catchAllSources.map(source => source.key).join(' and ')} both map every package (*); give private feeds specific patterns, such as Contoso.*.`
		});
	return issues;
}
