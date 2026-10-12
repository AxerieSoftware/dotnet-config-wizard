import type { Catalog, CatalogOption, CatalogRule } from '../catalog/catalog.ts';
import type { ResolvedScope } from './scopes.ts';
import { compareCSharpVersions, getDefaultCSharpVersion, hasApisOf } from './targetFrameworks.ts';
import type { WizardConfig } from './wizardConfig.ts';

const LATEST_LANG_VERSION = 'latest';

/** What a scope's code is built with, which decides the rules and options that apply to it. */
export type GateContext = { csharpVersion: string; tfms: string[] };

export function toGateContext(config: WizardConfig, scope: ResolvedScope, catalog: Catalog): GateContext {
	const tfms = scope.tfms.length > 0 ? scope.tfms : [`net${catalog.band.channel}`];
	return { csharpVersion: toCSharpVersion(config.versions.langVersion, tfms, catalog), tfms };
}

/** Why a rule doesn't apply to a scope, or undefined when it does. */
export function getRuleBlocker(rule: CatalogRule, context: GateContext): string | undefined {
	if (rule.minimumCSharpVersion && compareCSharpVersions(context.csharpVersion, rule.minimumCSharpVersion) < 0) return `Needs C# ${rule.minimumCSharpVersion}`;
	if (rule.minimumTargetFramework && !context.tfms.every(tfm => hasApisOf(tfm, rule.minimumTargetFramework as string))) return `Needs ${rule.minimumTargetFramework} APIs in every target`;
	return undefined;
}

/** Why an option doesn't apply to a scope, or undefined when it does. */
export function getOptionBlocker(option: CatalogOption, context: GateContext): string | undefined {
	if (option.minimumCSharpVersion && compareCSharpVersions(context.csharpVersion, option.minimumCSharpVersion) < 0) return `Needs C# ${option.minimumCSharpVersion}`;
	return undefined;
}

/**
 * The language version the compiler uses: LangVersion when set, `latest` meaning the newest the SDK ships, otherwise the
 * oldest default among the target frameworks, since every one of them must compile.
 */
function toCSharpVersion(langVersion: string | null, tfms: string[], catalog: Catalog): string {
	if (langVersion === LATEST_LANG_VERSION) return getDefaultCSharpVersion(`net${catalog.band.channel}`);
	if (langVersion) return langVersion;

	return tfms.map(getDefaultCSharpVersion).sort(compareCSharpVersions)[0];
}
