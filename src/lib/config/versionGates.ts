import type { Catalog, CatalogOption, CatalogRule } from '../catalog/catalog.ts';
import type { ResolvedScope } from './scopes.ts';
import { compareCSharpVersions, getDefaultCSharpVersion } from './targetFrameworks.ts';

/** What a scope's code is built with, which decides the rules and options that apply to it. */
export type GateContext = { csharpVersion: string; tfms: string[] };

export function toGateContext(scope: ResolvedScope, catalog: Catalog): GateContext {
	const tfms = scope.tfms.length > 0 ? scope.tfms : [`net${catalog.band.channel}`];
	return { csharpVersion: toCSharpVersion(tfms), tfms };
}

/** Why a rule doesn't apply to a scope, or undefined when it does. */
export function getRuleBlocker(rule: CatalogRule, context: GateContext): string | undefined {
	if (rule.minimumCSharpVersion && compareCSharpVersions(context.csharpVersion, rule.minimumCSharpVersion) < 0) return `Needs C# ${rule.minimumCSharpVersion}`;
	return undefined;
}

/** Why an option doesn't apply to a scope, or undefined when it does. */
export function getOptionBlocker(option: CatalogOption, context: GateContext): string | undefined {
	if (option.minimumCSharpVersion && compareCSharpVersions(context.csharpVersion, option.minimumCSharpVersion) < 0) return `Needs C# ${option.minimumCSharpVersion}`;
	return undefined;
}

/** The oldest default C# version among the target frameworks, since the code must compile for every one of them. */
function toCSharpVersion(tfms: string[]): string {
	return tfms.map(getDefaultCSharpVersion).sort(compareCSharpVersions)[0];
}
