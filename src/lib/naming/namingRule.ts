import type { Severity } from '../config/wizardConfig.ts';

export const SYMBOL_KINDS = [
	'*',
	'namespace',
	'class',
	'struct',
	'interface',
	'enum',
	'property',
	'method',
	'field',
	'event',
	'delegate',
	'parameter',
	'type_parameter',
	'local',
	'local_function'
] as const;
export const ACCESSIBILITIES = ['*', 'public', 'internal', 'private', 'protected', 'protected_internal', 'private_protected', 'local'] as const;
export const MODIFIERS = ['abstract', 'async', 'const', 'readonly', 'static'] as const;
export const CAPITALIZATIONS = ['pascal_case', 'camel_case', 'first_word_upper', 'all_upper', 'all_lower'] as const;

export type Capitalization = (typeof CAPITALIZATIONS)[number];

/**
 * One naming rule: which symbols it covers and how they must be named. The output derives the symbol group, style and
 * rule names from it, so users never manage the three-way `dotnet_naming_*` links themselves. Roslyn orders rules by
 * how specific they are, so the order of rules doesn't matter.
 */
export type NamingRule = {
	/** Name of the symbol group, such as `interfaces`, which also names the rule. */
	symbols: string;
	applicableKinds: string[];
	applicableAccessibilities: string[];
	requiredModifiers: string[];
	capitalization: Capitalization;
	requiredPrefix: string;
	requiredSuffix: string;
	wordSeparator: string;
	severity: Severity;
};

/** Starting points for the naming step, matching common .NET conventions. */
export const NAMING_TEMPLATES: readonly NamingRule[] = [
	{
		symbols: 'interfaces',
		applicableKinds: ['interface'],
		applicableAccessibilities: ['*'],
		requiredModifiers: [],
		capitalization: 'pascal_case',
		requiredPrefix: 'I',
		requiredSuffix: '',
		wordSeparator: '',
		severity: 'warning'
	},
	{
		symbols: 'type_parameters',
		applicableKinds: ['type_parameter'],
		applicableAccessibilities: ['*'],
		requiredModifiers: [],
		capitalization: 'pascal_case',
		requiredPrefix: 'T',
		requiredSuffix: '',
		wordSeparator: '',
		severity: 'warning'
	},
	{
		symbols: 'types',
		applicableKinds: ['class', 'struct', 'interface', 'enum', 'delegate'],
		applicableAccessibilities: ['*'],
		requiredModifiers: [],
		capitalization: 'pascal_case',
		requiredPrefix: '',
		requiredSuffix: '',
		wordSeparator: '',
		severity: 'warning'
	},
	{
		symbols: 'members',
		applicableKinds: ['property', 'method', 'event'],
		applicableAccessibilities: ['*'],
		requiredModifiers: [],
		capitalization: 'pascal_case',
		requiredPrefix: '',
		requiredSuffix: '',
		wordSeparator: '',
		severity: 'warning'
	},
	{
		symbols: 'async_methods',
		applicableKinds: ['method'],
		applicableAccessibilities: ['*'],
		requiredModifiers: ['async'],
		capitalization: 'pascal_case',
		requiredPrefix: '',
		requiredSuffix: 'Async',
		wordSeparator: '',
		severity: 'warning'
	},
	{
		symbols: 'constants',
		applicableKinds: ['field', 'local'],
		applicableAccessibilities: ['*'],
		requiredModifiers: ['const'],
		capitalization: 'pascal_case',
		requiredPrefix: '',
		requiredSuffix: '',
		wordSeparator: '',
		severity: 'warning'
	},
	{
		symbols: 'private_fields',
		applicableKinds: ['field'],
		applicableAccessibilities: ['private'],
		requiredModifiers: [],
		capitalization: 'camel_case',
		requiredPrefix: '',
		requiredSuffix: '',
		wordSeparator: '',
		severity: 'warning'
	},
	{
		symbols: 'private_fields_underscored',
		applicableKinds: ['field'],
		applicableAccessibilities: ['private'],
		requiredModifiers: [],
		capitalization: 'camel_case',
		requiredPrefix: '_',
		requiredSuffix: '',
		wordSeparator: '',
		severity: 'warning'
	},
	{
		symbols: 'parameters_and_locals',
		applicableKinds: ['parameter', 'local'],
		applicableAccessibilities: ['*'],
		requiredModifiers: [],
		capitalization: 'camel_case',
		requiredPrefix: '',
		requiredSuffix: '',
		wordSeparator: '',
		severity: 'warning'
	}
];

/** A readable style name from its properties, such as `pascal_case` or `prefix_i_pascal_case`. */
export function toStyleName(rule: NamingRule): string {
	const prefix = rule.requiredPrefix ? `prefix_${toNamePart(rule.requiredPrefix)}_` : '';
	const suffix = rule.requiredSuffix ? `_suffix_${toNamePart(rule.requiredSuffix)}` : '';
	const separator = rule.wordSeparator ? `_separator_${toNamePart(rule.wordSeparator)}` : '';
	return `${prefix}${rule.capitalization}${suffix}${separator}`;
}

/** Turns typed text into a valid symbol group name, such as `private fields` into `private_fields`. */
export function toSymbolGroupName(text: string): string {
	return text.trim().replaceAll(/\W+/g, '_');
}

export function toRuleName(rule: NamingRule): string {
	return `${rule.symbols}_should_be_${toStyleName(rule)}`;
}

function toNamePart(text: string): string {
	const namePart = text
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '_')
		.replaceAll(/^_+|_+$/g, '');
	return namePart === '' ? 'underscore' : namePart;
}
