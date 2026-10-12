import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { checkEditorConfigKeys } from './checkEditorConfigKeys.ts';

const catalog = readCatalog('10.0.4xx');

describe('checkEditorConfigKeys', () => {
	it('accepts standard, option, diagnostic and naming keys', () => {
		const content = [
			'root = true',
			'[*.cs]',
			'indent_style = tab',
			'dotnet_style_qualification_for_field = true',
			'dotnet_diagnostic.CA1822.severity = warning',
			'dotnet_analyzer_diagnostic.category-Performance.severity = warning',
			'dotnet_naming_rule.interfaces_start_with_i.severity = warning',
			'dotnet_naming_style.prefix_i.required_prefix = I'
		].join('\n');

		expect(checkEditorConfigKeys(content, catalog)).toEqual([]);
	});

	it('flags keys and rule IDs Roslyn would silently ignore', () => {
		const content = ['[*.cs]', 'dotnet_style_qualification_for_fields = true', 'dotnet_diagnostic.CA9999.severity = warning', 'dotnet_naming_style.prefix_i.prefix = I'].join('\n');

		expect(checkEditorConfigKeys(content, catalog).map(problem => problem.lineNumber)).toEqual([2, 3, 4]);
	});

	it('flags a value that ends in an inline comment', () => {
		const content = ['[*]', 'indent_style = tab # tabs please', 'end_of_line = lf ; unix'].join('\n');

		expect(checkEditorConfigKeys(content, catalog).map(problem => problem.lineNumber)).toEqual([2, 3]);
	});
});
