import type { Catalog } from '../catalog/catalog.ts';

export type KeyProblem = { lineNumber: number; message: string };

const STANDARD_KEYS = new Set(['root', 'charset', 'indent_style', 'indent_size', 'tab_width', 'end_of_line', 'insert_final_newline', 'trim_trailing_whitespace', 'max_line_length']);
const ROSLYN_KEYS = new Set(['generated_code', 'file_header_template', 'dotnet_analyzer_diagnostic.severity']);
const ROSLYN_KEY_PATTERNS = [/^dotnet_code_quality\..+$/, /^dotnet_analyzer_diagnostic\.category-[\w-]+\.severity$/];
const DIAGNOSTIC_KEY = /^dotnet_diagnostic\.(?<id>[^.]+)\.severity$/;
const NAMING_SUBKEYS: Record<string, Set<string>> = {
	rule: new Set(['severity', 'symbols', 'style']),
	symbols: new Set(['applicable_kinds', 'applicable_accessibilities', 'required_modifiers']),
	style: new Set(['required_prefix', 'required_suffix', 'word_separator', 'capitalization'])
};
const NAMING_KEY = /^dotnet_naming_(?<kind>rule|symbols|style)\.[\w-]+\.(?<subkey>\w+)$/;

/**
 * Finds keys Roslyn would silently ignore, because they aren't in the catalog, and values that end in what looks like a
 * comment. EditorConfig has no inline comments, so ` #` or ` ;` would become part of the value.
 */
export function checkEditorConfigKeys(content: string, catalog: Catalog): KeyProblem[] {
	const problems: KeyProblem[] = [];

	for (const [index, rawLine] of content.split('\n').entries()) {
		const line = rawLine.trim();
		if (line === '' || line.startsWith('#') || line.startsWith(';') || (line.startsWith('[') && line.endsWith(']'))) continue;

		const lineNumber = index + 1;
		const separatorIndex = line.indexOf('=');
		if (separatorIndex === -1) {
			problems.push({ lineNumber, message: `"${line}" isn't a key = value pair.` });
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		const value = line.slice(separatorIndex + 1).trim();
		const keyProblem = findKeyProblem(key, catalog);
		if (keyProblem) problems.push({ lineNumber, message: keyProblem });
		if (/\s[#;]/.test(value)) problems.push({ lineNumber, message: `The value of ${key} contains an inline comment, which EditorConfig treats as part of the value.` });
	}

	return problems;
}

function findKeyProblem(key: string, catalog: Catalog): string | undefined {
	if (STANDARD_KEYS.has(key) || ROSLYN_KEYS.has(key) || catalog.options.has(key)) return undefined;
	if (ROSLYN_KEY_PATTERNS.some(pattern => pattern.test(key))) return undefined;

	const diagnosticMatch = DIAGNOSTIC_KEY.exec(key);
	if (diagnosticMatch?.groups) return catalog.rules.has(diagnosticMatch.groups.id) ? undefined : `Rule ${diagnosticMatch.groups.id} isn't in the catalog for SDK ${catalog.band}.`;

	const namingMatch = NAMING_KEY.exec(key);
	if (namingMatch?.groups) return NAMING_SUBKEYS[namingMatch.groups.kind].has(namingMatch.groups.subkey) ? undefined : `${key} isn't a naming key Roslyn reads.`;

	return `${key} isn't a key Roslyn reads.`;
}
