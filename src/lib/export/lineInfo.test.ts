import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { describeLine } from './lineInfo.ts';

const catalog = readCatalog('10.0.4xx');

describe('describeLine', () => {
	it('explains a rule severity and jumps to the rule table filtered to it', () => {
		const info = describeLine('.editorconfig', 'dotnet_diagnostic.CA1848.severity = warning', '[*.cs]', catalog);

		expect(info?.title).toBe('CA1848: Use the LoggerMessage delegates');
		expect(info?.href).toBe('/rules/CA1848');
		expect(info?.target).toEqual({ path: '/wizard/analyzers', selector: '[aria-label="CA1848 severity"]', ruleSearch: 'CA1848' });
	});

	it('sends a code-style rule with an option to the Code style step', () => {
		const info = describeLine('.editorconfig', 'dotnet_diagnostic.IDE0161.severity = warning', '[*.cs]', catalog);

		expect(info?.target).toEqual({ path: '/wizard/code-style', selector: '[aria-label="IDE0161 severity"]' });
	});

	it('explains an option with its values and the value in effect', () => {
		const info = describeLine('tests/.editorconfig', 'csharp_style_namespace_declarations = file_scoped', '[*.cs]', catalog);

		expect(info?.option?.value).toBe('file_scoped');
		expect(info?.option?.option.values.map(value => value.value)).toContain('block_scoped');
		expect(info?.target).toEqual({ path: '/wizard/code-style', selector: '[aria-label="csharp_style_namespace_declarations"]' });
	});

	it('finds the formatting control for the section a key is in', () => {
		const info = describeLine('.editorconfig', 'indent_style = tab', '[*.cs]', catalog);

		expect(info?.target).toEqual({ path: '/wizard/formatting', selector: '[aria-label="C# files: Indent style"]' });
	});

	it('explains MSBuild properties and package references', () => {
		expect(describeLine('Directory.Build.props', '<TreatWarningsAsErrors>true</TreatWarningsAsErrors>', undefined, catalog)?.target).toEqual({
			path: '/wizard/build',
			selector: '[aria-label="TreatWarningsAsErrors"]'
		});
		expect(describeLine('Directory.Packages.props', '<GlobalPackageReference Include="Meziantou.Analyzer" Version="3.0.299" />', undefined, catalog)?.target).toEqual({
			path: '/wizard/analyzers',
			selector: '[data-package="Meziantou.Analyzer"]'
		});
	});

	it('has nothing to say about comments and blank lines', () => {
		expect(describeLine('.editorconfig', '# CA1848: Use the LoggerMessage delegates', '[*.cs]', catalog)).toBeUndefined();
		expect(describeLine('Directory.Build.props', '', undefined, catalog)).toBeUndefined();
	});
});
