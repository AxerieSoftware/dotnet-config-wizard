import type { ScopeConfig } from '../config/wizardConfig.ts';
import type { ImportResult } from './importResult.ts';

/** Merges imported settings into a scope: imported values win, lists of packages combine, and naming rules replace by symbol group. */
export function mergeImport(scope: ScopeConfig, settings: ImportResult['settings']): void {
	for (const [glob, values] of Object.entries(settings.formatting ?? {})) {
		scope.formatting ??= {};
		scope.formatting[glob] = { ...scope.formatting[glob], ...values };
	}

	if (settings.options) scope.options = { ...scope.options, ...settings.options };
	if (settings.severities) scope.severities = { ...scope.severities, ...settings.severities };
	if (settings.categorySeverities) scope.categorySeverities = { ...scope.categorySeverities, ...settings.categorySeverities };
	if (settings.build) scope.build = { ...scope.build, ...settings.build };
	if (settings.ciBuild) scope.ciBuild = { ...scope.ciBuild, ...settings.ciBuild };
	if (settings.tfms && settings.tfms.length > 0) scope.tfms = settings.tfms;
	if (settings.packages) scope.packages = [...new Set([...(scope.packages ?? []), ...settings.packages])];
	if (settings.naming) {
		const importedSymbols = new Set(settings.naming.map(rule => rule.symbols));
		scope.naming = [...(scope.naming ?? []).filter(rule => !importedSymbols.has(rule.symbols)), ...settings.naming];
	}
}
