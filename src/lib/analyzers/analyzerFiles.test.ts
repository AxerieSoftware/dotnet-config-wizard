import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import { toBannedSymbolsText } from './bannedApis.ts';
import { toSonarLintXml } from './sonarLintXml.ts';

describe('analyzer files', () => {
	it('writes one documentation ID and message per BannedSymbols.txt line', () => {
		expect(toBannedSymbolsText([{ symbol: 'T:System.Console', message: 'Use ILogger.' }])).toBe('T:System.Console;Use ILogger.\n');
	});

	it('writes Sonar parameters as escaped SonarLint.xml rules', () => {
		const xml = toSonarLintXml({ S107: { max: '5' }, S100: { format: '^[A-Z]<&>$' } });

		expect(xml).toContain('<Key>S107</Key>');
		expect(xml).toContain('<Key>max</Key>\n          <Value>5</Value>');
		expect(xml).toContain('<Value>^[A-Z]&lt;&amp;&gt;$</Value>');
		expect(xml.indexOf('S100')).toBeLessThan(xml.indexOf('S107'));
	});

	it('writes analyzer files only for scopes that reference the analyzer package', () => {
		const catalog = readCatalog('10.0.4xx');
		const scope = { path: '', bannedApis: [{ symbol: 'T:System.Console', message: 'Use ILogger.' }], ruleParameters: { S107: { max: '5' } } };

		const withoutPackages = toGeneratedOutput({ versions: { sdkBand: '10.0.4xx' }, scopes: [scope] }, catalog, { commentStyle: 'none' });
		const withPackages = toGeneratedOutput({ versions: { sdkBand: '10.0.4xx' }, scopes: [{ ...scope, packages: ['Microsoft.CodeAnalysis.BannedApiAnalyzers', 'SonarAnalyzer.CSharp'] }] }, catalog, {
			commentStyle: 'none'
		});

		expect(withoutPackages.files.map(file => file.path)).toEqual(['.editorconfig']);
		expect(withPackages.files.map(file => file.path)).toEqual(['.editorconfig', 'Directory.Build.props', 'BannedSymbols.txt', 'SonarLint.xml']);
	});

	it('writes options a rule reads from .editorconfig there, and only Sonar parameters to SonarLint.xml', () => {
		const catalog = readCatalog('10.0.4xx');
		const scope = {
			path: '',
			packages: ['Meziantou.Analyzer', 'SonarAnalyzer.CSharp'],
			ruleParameters: { MA0048: { 'MA0048.only_validate_first_type': 'true' }, S107: { max: '5' } }
		};

		const output = toGeneratedOutput({ versions: { sdkBand: '10.0.4xx' }, scopes: [scope] }, catalog, { commentStyle: 'idAndTitle' });
		const file = (path: string) => output.files.find(candidate => candidate.path === path)?.content ?? '';

		expect(file('.editorconfig')).toMatch(/## Rule options\n# MA0048: File name must match type name\nMA0048\.only_validate_first_type = true/);
		expect(file('SonarLint.xml')).toContain('<Key>S107</Key>');
		expect(file('SonarLint.xml')).not.toContain('MA0048');
	});

	it('writes no SonarLint.xml when every parameter is an .editorconfig option', () => {
		const catalog = readCatalog('10.0.4xx');
		const scope = { path: '', packages: ['Meziantou.Analyzer', 'SonarAnalyzer.CSharp'], ruleParameters: { MA0048: { 'MA0048.mode': 'Prefix' } } };

		const output = toGeneratedOutput({ versions: { sdkBand: '10.0.4xx' }, scopes: [scope] }, catalog, { commentStyle: 'none' });

		expect(output.files.map(file => file.path)).not.toContain('SonarLint.xml');
		expect(output.files.find(file => file.path === 'Directory.Build.props')?.content).not.toContain('SonarLint.xml');
	});
});
