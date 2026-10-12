import type { EditorConfigBlock } from '../export/editorConfigDocument.ts';
import { type NamingRule, toRuleName, toStyleName } from './namingRule.ts';

/** Writes naming rules as rules, symbol groups and styles, sharing a style between rules that name things the same way. */
export function toNamingBlocks(rules: readonly NamingRule[]): EditorConfigBlock[] {
	if (rules.length === 0) return [];

	const styles = new Map(rules.map(rule => [toStyleName(rule), rule]));

	return [
		{
			heading: 'Naming rules (IDE1006)',
			entries: rules.flatMap(rule => {
				const ruleName = toRuleName(rule);
				return [
					{ key: `dotnet_naming_rule.${ruleName}.severity`, value: rule.severity },
					{ key: `dotnet_naming_rule.${ruleName}.symbols`, value: rule.symbols },
					{ key: `dotnet_naming_rule.${ruleName}.style`, value: toStyleName(rule) }
				];
			})
		},
		{
			heading: 'Naming symbol groups',
			entries: rules.flatMap(rule => [
				{ key: `dotnet_naming_symbols.${rule.symbols}.applicable_kinds`, value: rule.applicableKinds.join(', ') },
				{ key: `dotnet_naming_symbols.${rule.symbols}.applicable_accessibilities`, value: rule.applicableAccessibilities.join(', ') },
				...(rule.requiredModifiers.length > 0 ? [{ key: `dotnet_naming_symbols.${rule.symbols}.required_modifiers`, value: rule.requiredModifiers.join(', ') }] : [])
			])
		},
		{
			heading: 'Naming styles',
			entries: styles
				.entries()
				.flatMap(([styleName, rule]) => [
					{ key: `dotnet_naming_style.${styleName}.capitalization`, value: rule.capitalization },
					...(rule.requiredPrefix ? [{ key: `dotnet_naming_style.${styleName}.required_prefix`, value: rule.requiredPrefix }] : []),
					...(rule.requiredSuffix ? [{ key: `dotnet_naming_style.${styleName}.required_suffix`, value: rule.requiredSuffix }] : []),
					...(rule.wordSeparator ? [{ key: `dotnet_naming_style.${styleName}.word_separator`, value: rule.wordSeparator }] : [])
				])
				.toArray()
		}
	];
}
