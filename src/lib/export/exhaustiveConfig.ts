import type { Catalog } from '../catalog/catalog.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';

/**
 * A config that sets every C# option to its default and every build-enforced rule to warning. CI renders it to prove
 * every key the catalog offers is one Roslyn accepts.
 */
export function toExhaustiveConfig(catalog: Catalog): WizardConfig {
	const options = Object.fromEntries(
		catalog.options
			.values()
			.filter(option => option.languages.includes('csharp') && option.defaultValue !== null)
			.map(option => [option.name, option.defaultValue as string])
	);

	const severities = Object.fromEntries(
		catalog.rules
			.values()
			.filter(rule => rule.isEnforcedOnBuild)
			.map(rule => [rule.id, 'warning' as const])
	);

	return {
		versions: { sdkBand: catalog.band, langVersion: null },
		scopes: [
			{
				path: '',
				formatting: { '[*]': { charset: 'utf-8', end_of_line: 'lf', indent_style: 'space', indent_size: '4', insert_final_newline: 'true', trim_trailing_whitespace: 'true' } },
				options,
				severities
			}
		]
	};
}
