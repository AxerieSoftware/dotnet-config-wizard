import type { Catalog } from '../catalog/catalog.ts';
import { SEVERITIES, type Severity } from '../config/wizardConfig.ts';
import { HEADER_PATTERN } from '../export/editorConfigFiles.ts';
import { FORMATTING_KEYS } from '../formatting/formattingKeys.ts';
import { CAPITALIZATIONS, type Capitalization, type NamingRule } from '../naming/namingRule.ts';
import { type ImportNote, type ImportResult, toUnmaintainedNotes } from './importResult.ts';

const FORMATTING_KEY_NAMES = new Set([...FORMATTING_KEYS.map(key => key.key), 'max_line_length']);
const DIAGNOSTIC_KEY = /^dotnet_diagnostic\.(?<id>[^.]+)\.severity$/;
const CATEGORY_KEY = /^dotnet_analyzer_diagnostic\.category-(?<category>[\w-]+)\.severity$/;
const NAMING_KEY = /^dotnet_naming_(?<kind>rule|symbols|style)\.(?<name>[\w-]+)\.(?<property>\w+)$/;
const INLINE_COMMENT = /\s+[#;].*$/;

type NamingParts = Record<string, Record<string, Record<string, string>>>;

/**
 * Reads an `.editorconfig` into scope settings. Keys the wizard models are kept, legacy `value:severity` suffixes become
 * rule severities, and anything else is reported rather than silently lost.
 */
export function importEditorConfig(text: string, catalog: Catalog): ImportResult {
	const settings: ImportResult['settings'] = {};
	const notes: ImportNote[] = [];
	const unsupportedKeys = new Set<string>();
	const droppedRuleIds: string[] = [];
	const naming: NamingParts = { rule: {}, symbols: {}, style: {} };
	let glob: string | undefined;
	let trailingCommentCount = 0;

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;
		if (line.startsWith('[') && line.endsWith(']')) {
			glob = line;
			continue;
		}

		const separatorIndex = line.indexOf('=');
		if (separatorIndex === -1) continue;

		const key = line.slice(0, separatorIndex).trim();
		let value = line.slice(separatorIndex + 1).trim();
		if (INLINE_COMMENT.test(value)) {
			value = value.replace(INLINE_COMMENT, '');
			trailingCommentCount++;
		}

		// A global AnalyzerConfig has no sections; its keys apply to every C# file.
		if (key.toLowerCase() === 'is_global') {
			glob = '[*.cs]';
			continue;
		}

		if (key.toLowerCase() === 'root' || key.toLowerCase() === 'global_level' || !glob) continue;

		const lowerKey = key.toLowerCase();
		if (FORMATTING_KEY_NAMES.has(lowerKey)) {
			settings.formatting ??= {};
			settings.formatting[glob] ??= {};
			settings.formatting[glob][lowerKey] = value;
			continue;
		}

		const diagnostic = DIAGNOSTIC_KEY.exec(key)?.groups;
		if (diagnostic) {
			if (!isSeverity(value)) continue;
			if (catalog.rules.has(diagnostic.id)) {
				settings.severities ??= {};
				settings.severities[diagnostic.id] = value;
			} else {
				droppedRuleIds.push(diagnostic.id);
			}
			continue;
		}

		const category = CATEGORY_KEY.exec(key)?.groups;
		if (category && isSeverity(value)) {
			settings.categorySeverities ??= {};
			settings.categorySeverities[category.category] = value;
			continue;
		}

		const namingKey = NAMING_KEY.exec(lowerKey)?.groups;
		if (namingKey) {
			naming[namingKey.kind][namingKey.name] ??= {};
			naming[namingKey.kind][namingKey.name][namingKey.property] = value;
			continue;
		}

		const option = catalog.options.get(lowerKey);
		if (option) {
			const [optionValue, legacySeverity] = value.split(':').map(part => part.trim());
			settings.options ??= {};
			settings.options[lowerKey] = optionValue;
			if (legacySeverity && isSeverity(legacySeverity)) notes.push(...toLegacySeverityNotes(lowerKey, legacySeverity, option.ruleIds, settings));
			continue;
		}

		unsupportedKeys.add(key);
	}

	const namingRules = toNamingRules(naming, notes);
	if (namingRules.length > 0) settings.naming = namingRules;

	notes.push(...toUnmaintainedNotes(droppedRuleIds));
	const otherDroppedIds = droppedRuleIds.filter(id => toUnmaintainedNotes([id]).length === 0);
	if (otherDroppedIds.length > 0)
		notes.push({ severity: 'warning', message: `${otherDroppedIds.join(', ')} aren't in SDK ${catalog.band.band} or the supported analyzer packages, so they were dropped.` });
	if (unsupportedKeys.size > 0) notes.push({ severity: 'info', message: `${[...unsupportedKeys].join(', ')} aren't settings the wizard supports, so they were dropped.` });
	if (trailingCommentCount > 0)
		notes.push({ severity: 'info', message: `Dropped ${trailingCommentCount} trailing comments. EditorConfig doesn't support inline comments, so they were part of the values.` });

	return { settings, notes, catalogVersion: HEADER_PATTERN.exec(text)?.groups?.catalogVersion };
}

/** A legacy `option = value:severity` sets the severity of the option's rule when it has exactly one. */
function toLegacySeverityNotes(optionName: string, severity: Severity, ruleIds: readonly string[], settings: ImportResult['settings']): ImportNote[] {
	if (ruleIds.length !== 1)
		return [{ severity: 'info', message: `${optionName} had a legacy :${severity} suffix, but it feeds ${ruleIds.length} rules, so set their severities on the Code style step.` }];

	settings.severities ??= {};
	settings.severities[ruleIds[0]] ??= severity;
	return [];
}

/** Rebuilds naming rules from their rule, symbol group and style keys; incomplete rules are reported. */
function toNamingRules(naming: NamingParts, notes: ImportNote[]): NamingRule[] {
	return Object.entries(naming.rule).flatMap(([ruleName, rule]) => {
		const symbols = rule.symbols ? naming.symbols[rule.symbols] : undefined;
		const style = rule.style ? naming.style[rule.style] : undefined;
		const capitalization = (style?.capitalization ?? 'pascal_case') as Capitalization;
		if (!symbols || !style || !CAPITALIZATIONS.includes(capitalization)) {
			notes.push({ severity: 'warning', message: `Naming rule ${ruleName} is missing its symbol group or style, so it was dropped.` });
			return [];
		}

		return [
			{
				symbols: rule.symbols,
				applicableKinds: toList(symbols.applicable_kinds ?? '*'),
				applicableAccessibilities: toList(symbols.applicable_accessibilities ?? '*'),
				requiredModifiers: toList(symbols.required_modifiers ?? ''),
				capitalization,
				requiredPrefix: style.required_prefix ?? '',
				requiredSuffix: style.required_suffix ?? '',
				wordSeparator: style.word_separator ?? '',
				severity: isSeverity(rule.severity ?? '') ? (rule.severity as Severity) : 'suggestion'
			}
		];
	});
}

function toList(value: string): string[] {
	return value
		.split(',')
		.map(entry => entry.trim())
		.filter(entry => entry !== '');
}

function isSeverity(value: string): value is Severity {
	return SEVERITIES.includes(value as Severity);
}
