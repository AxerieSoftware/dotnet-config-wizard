import { BANNED_API_SETS } from '../analyzers/bannedApis.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { getDefaultCSharpVersion } from '../config/targetFrameworks.ts';
import { getOptionBlocker, getRuleBlocker } from '../config/versionGates.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import { NAMING_TEMPLATES } from '../naming/namingRule.ts';

/**
 * A config that references every analyzer package and sets every C# option to its default, every build-enforced rule
 * to warning, every naming template, every Sonar parameter and every banned API set, plus a nested test scope. It targets the band's own framework and includes everything that framework's C# version
 * supports. CI renders it to prove every key the catalog offers is one Roslyn accepts.
 */
export function toExhaustiveConfig(catalog: Catalog): WizardConfig {
	const tfm = `net${catalog.band.channel}`;
	const packages = [...catalog.packages.keys()];
	const context = { csharpVersion: getDefaultCSharpVersion(tfm), tfms: [tfm], packages };

	const options = Object.fromEntries(
		catalog.options
			.values()
			.filter(option => option.languages.includes('csharp') && option.defaultValue !== null && !getOptionBlocker(option, context))
			.map(option => [option.name, option.defaultValue as string])
	);

	const severities = Object.fromEntries(
		catalog.rules
			.values()
			.filter(rule => rule.isEnforcedOnBuild && !getRuleBlocker(rule, context))
			.map(rule => [rule.id, 'warning' as const])
	);

	return {
		versions: { sdkBand: catalog.band.band },
		scopes: [
			{
				path: '',
				tfms: [tfm],
				formatting: { '[*]': { charset: 'utf-8', end_of_line: 'lf', indent_style: 'space', indent_size: '4', insert_final_newline: 'true', trim_trailing_whitespace: 'true' } },
				options,
				severities,
				naming: [...NAMING_TEMPLATES],
				packages,
				ruleParameters: toDefaultRuleParameters(catalog),
				bannedApis: BANNED_API_SETS.flatMap(set => set.apis)
			},
			{ path: 'tests', projectKind: 'test', severities: { CA1707: 'none' } }
		]
	};
}

function toDefaultRuleParameters(catalog: Catalog): Record<string, Record<string, string>> {
	return Object.fromEntries(
		catalog.rules
			.values()
			.filter(rule => rule.parameters.some(parameter => parameter.defaultValue))
			.map(rule => [rule.id, Object.fromEntries(rule.parameters.filter(parameter => parameter.defaultValue).map(parameter => [parameter.key, parameter.defaultValue as string]))])
	);
}
