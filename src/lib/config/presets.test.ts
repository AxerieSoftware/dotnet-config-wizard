import { describe, expect, it } from 'vitest';
import { readBands, readCatalog } from '../../../scripts/readCatalog.ts';
import { parseAnalysisLevel } from '../analyzers/analysisLevel.ts';
import { getEffectiveSeverity, isReported } from '../analyzers/effectiveSeverity.ts';
import { findActiveOverlaps } from '../analyzers/overlaps.ts';
import { checkEditorConfigKeys } from '../export/checkEditorConfigKeys.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import { ALL_PRESETS, type Preset, toPresetConfig, toPresetName } from './presets.ts';
import { resolveScope } from './scopes.ts';

const BAND = '10.0.4xx';
const catalog = readCatalog(BAND);
const ANALYZING_PRESETS: readonly Preset[] = ALL_PRESETS.filter(preset => preset.level === 'recommended' || preset.level === 'strict' || preset.level === 'opinionated');
const named = (presets: readonly Preset[]) => presets.map(preset => ({ name: toPresetName(preset), preset }));

function render(preset: Preset, bandName = BAND) {
	const bandCatalog = readCatalog(bandName);
	const config = toPresetConfig(preset, bandCatalog);
	const output = toGeneratedOutput(config, bandCatalog, { commentStyle: 'idAndTitle' });
	return { config, output, file: (path: string) => output.files.find(file => file.path === path)?.content ?? '' };
}

describe.each(readBands().map(band => band.band))('every preset on SDK %s', bandName => {
	it.each(named(ALL_PRESETS))('$name writes only keys Roslyn reads and leaves nothing out', ({ preset }) => {
		const { output } = render(preset, bandName);

		expect(output.skippedKeys).toEqual([]);
		for (const file of output.files.filter(file => file.path.endsWith('.editorconfig'))) expect(checkEditorConfigKeys(file.content, readCatalog(bandName))).toEqual([]);
	});

	it.each(named(ALL_PRESETS))('$name leaves exactly one active rule per concern in every folder', ({ preset }) => {
		const bandCatalog = readCatalog(bandName);
		const config = toPresetConfig(preset, bandCatalog);

		for (const scope of config.scopes) {
			const resolved = resolveScope(config, scope);
			const overlaps = findActiveOverlaps(bandCatalog, rule => (!rule.packageId || resolved.packages.includes(rule.packageId)) && isReported(getEffectiveSeverity(rule, resolved, bandCatalog)));
			expect(overlaps).toEqual([]);
		}
	});

	it.each(named(ALL_PRESETS))('$name never pairs TreatWarningsAsErrors with AnalysisMode all', ({ preset }) => {
		const { config } = render(preset, bandName);

		for (const scope of config.scopes) {
			const resolved = resolveScope(config, scope);
			const isWarningsAsErrors = resolved.build.TreatWarningsAsErrors === 'true' || resolved.ciBuild.TreatWarningsAsErrors === 'true';
			expect(isWarningsAsErrors && parseAnalysisLevel(resolved.build.AnalysisLevel, readCatalog(bandName).band).mode === 'all').toBe(false);
		}
	});
});

describe('combining a strictness with a project kind', () => {
	it('gives Strict for libraries both the strict and the library settings', () => {
		const { file } = render({ level: 'strict', kind: 'library' });

		expect(file('Directory.Build.props')).toMatch(/Label="Warnings">\s*<!--[^>]*-->\s*<TreatWarningsAsErrors>true/);
		expect(file('src/Directory.Build.props')).toContain('<IsAotCompatible>true</IsAotCompatible>');
		expect(file('Directory.Packages.props')).toContain('Include="SonarAnalyzer.CSharp"');
		expect(file('src/Directory.Packages.props')).toContain('Include="Microsoft.CodeAnalysis.PublicApiAnalyzers"');
		expect(file('.editorconfig')).toContain('dotnet_analyzer_diagnostic.category-Performance.severity = error');
		expect(file('src/.editorconfig')).toContain('dotnet_diagnostic.CA2007.severity = warning');
	});

	it('ignores the project kind below Recommended', () => {
		const config = toPresetConfig({ level: 'microsoft-conventions', kind: 'library' }, catalog);

		expect(config.scopes.map(scope => scope.path)).toEqual(['']);
		expect(config.scopes[0].projectKind).toBeUndefined();
		expect(config.scopes[0].build).toEqual({ EnforceCodeStyleInBuild: 'true' });
	});

	it('leaves the repo root without a project kind and gives it to src', () => {
		const config = toPresetConfig({ level: 'recommended', kind: 'service' }, catalog);

		expect(config.scopes.map(scope => [scope.path, scope.projectKind])).toEqual([
			['', undefined],
			['src', 'service'],
			['tests', 'test']
		]);
	});
});

describe('C1: consistent style across developers', () => {
	it.each(named(ANALYZING_PRESETS))('$name enforces code style on build with line endings Git respects', ({ preset }) => {
		const { file } = render(preset);

		expect(file('.editorconfig')).toContain('root = true');
		expect(file('.gitattributes')).toContain('* text=auto eol=lf');
		expect(file('Directory.Build.props')).toContain('<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>');
		expect(file('.editorconfig')).toContain('dotnet_diagnostic.IDE0055.severity = warning');
		expect(file('.editorconfig')).toContain('dotnet_diagnostic.IDE0005.severity = warning');
		expect(file('Directory.Build.props')).toContain('<GenerateDocumentationFile>true</GenerateDocumentationFile>');
		expect(file('.editorconfig')).toContain('dotnet_diagnostic.IDE0076.severity = error');
	});

	it('fails CI builds on warnings in Recommended, every build in Strict, and never in Microsoft defaults', () => {
		expect(render({ level: 'recommended', kind: 'any' }).file('Directory.Build.props')).toMatch(/Label="CI builds only"[\s\S]*<TreatWarningsAsErrors>true/);
		expect(render({ level: 'strict', kind: 'any' }).file('Directory.Build.props')).toMatch(/Label="Warnings">\s*<!--[^>]*-->\s*<TreatWarningsAsErrors>true/);
		expect(render({ level: 'microsoft-defaults', kind: 'any' }).file('Directory.Build.props')).not.toContain('TreatWarningsAsErrors');
	});

	it('suppresses missing XML docs outside libraries only', () => {
		expect(render({ level: 'recommended', kind: 'service' }).file('.editorconfig')).toContain('dotnet_diagnostic.CS1591.severity = none');
		expect(render({ level: 'recommended', kind: 'library' }).file('src/.editorconfig')).toContain('dotnet_diagnostic.CS1591.severity = warning');
	});
});

describe('C2: performance', () => {
	it('raises the Performance category and logging rules, more in Strict', () => {
		expect(render({ level: 'recommended', kind: 'any' }).file('.editorconfig')).toContain('dotnet_analyzer_diagnostic.category-Performance.severity = warning');
		expect(render({ level: 'strict', kind: 'any' }).file('.editorconfig')).toContain('dotnet_analyzer_diagnostic.category-Performance.severity = error');
		expect(render({ level: 'strict', kind: 'any' }).file('.editorconfig')).toContain('dotnet_diagnostic.CA1848.severity = error');
		expect(render({ level: 'recommended', kind: 'any' }).file('.editorconfig')).toContain('dotnet_diagnostic.CA1873.severity = warning');
	});

	it('asks for ConfigureAwait and AOT compatibility in libraries only', () => {
		expect(render({ level: 'recommended', kind: 'library' }).file('src/.editorconfig')).toContain('dotnet_diagnostic.CA2007.severity = warning');
		expect(render({ level: 'recommended', kind: 'library' }).file('src/Directory.Build.props')).toContain('<IsAotCompatible>true</IsAotCompatible>');
		expect(render({ level: 'recommended', kind: 'service' }).file('.editorconfig')).not.toContain('dotnet_diagnostic.CA2007.severity = warning');
		expect(render({ level: 'recommended', kind: 'service' }).file('Directory.Build.props')).not.toContain('IsAotCompatible');
		expect(render({ level: 'recommended', kind: 'library' }).file('tests/.editorconfig')).toContain('dotnet_diagnostic.CA2007.severity = none');
	});

	it("uses only Microsoft's analyzers in Recommended, with the threading analyzers' general async rules", () => {
		const { file } = render({ level: 'recommended', kind: 'any' });

		expect(file('Directory.Packages.props')).toContain('Include="Microsoft.VisualStudio.Threading.Analyzers"');
		expect(file('Directory.Packages.props')).not.toMatch(/Include="(?:Meziantou|SonarAnalyzer)/);
		expect(file('.editorconfig')).toContain('dotnet_diagnostic.VSTHRD010.severity = none');
		expect(file('.editorconfig')).not.toContain('dotnet_diagnostic.VSTHRD002.severity');
	});

	it("lets Microsoft's threading analyzers own async concerns over Sonar's", () => {
		expect(render({ level: 'strict', kind: 'any' }).file('.editorconfig')).toContain('dotnet_diagnostic.S3168.severity = none');
	});

	it('leaves the noisiest auto-fixable style rules to Strict', () => {
		expect(render({ level: 'recommended', kind: 'any' }).file('.editorconfig')).not.toContain('dotnet_diagnostic.IDE0040.severity');
		expect(render({ level: 'strict', kind: 'any' }).file('.editorconfig')).toContain('dotnet_diagnostic.IDE0040.severity = warning');
		expect(render({ level: 'strict', kind: 'any' }).file('.editorconfig')).toContain('dotnet_diagnostic.IDE0300.severity = warning');
	});

	it("turns off Sonar's loop-to-LINQ rule in Strict", () => {
		expect(render({ level: 'strict', kind: 'any' }).file('.editorconfig')).toContain('dotnet_diagnostic.S3267.severity = none');
	});
});

describe('C3: security and supply chain', () => {
	it.each(named(ANALYZING_PRESETS))('$name makes security rules errors and locks down packages', ({ preset }) => {
		const { file } = render(preset);

		expect(file('.editorconfig')).toContain('dotnet_analyzer_diagnostic.category-Security.severity = error');
		expect(file('BannedSymbols.txt')).toContain('M:System.Text.RegularExpressions.Regex.#ctor(System.String);');
		expect(file('Directory.Build.props')).toContain('<NuGetAuditMode>all</NuGetAuditMode>');
		expect(file('Directory.Build.props')).toContain('<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>');
		expect(file('Directory.Build.props')).toMatch(/Label="CI builds only"[\s\S]*<RestoreLockedMode>true/);
		expect(file('Directory.Packages.props')).toContain('<CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled>');
		expect(file('nuget.config')).toContain('<clear />');
		expect(file('BannedSymbols.txt')).toContain('P:System.DateTime.UtcNow;');
	});

	it('bans Console only in library projects, so tests can still write to it', () => {
		const library = render({ level: 'recommended', kind: 'library' });

		expect(library.file('src/BannedSymbols.txt')).toContain('T:System.Console;');
		expect(library.file('BannedSymbols.txt')).not.toContain('T:System.Console;');
		expect(render({ level: 'recommended', kind: 'service' }).file('src/BannedSymbols.txt')).not.toContain('T:System.Console;');
	});

	it("bans synchronous form reads in services' src only", () => {
		const service = render({ level: 'recommended', kind: 'service' });

		expect(service.file('src/BannedSymbols.txt')).toContain('P:Microsoft.AspNetCore.Http.HttpRequest.Form;');
		expect(service.file('BannedSymbols.txt')).not.toContain('HttpRequest.Form');
	});
});

describe('C4: new language features as they ship', () => {
	it.each(named(ANALYZING_PRESETS))('$name tracks the SDK and never pins the language', ({ preset }) => {
		const { file } = render(preset);

		expect(file('Directory.Build.props')).toContain('<AnalysisLevel>latest-recommended</AnalysisLevel>');
		expect(file('Directory.Build.props')).not.toMatch(/LangVersion|WarningLevel/);
		expect(JSON.parse(file('global.json')).sdk).toEqual({ version: catalog.band.sdkVersion, rollForward: 'latestFeature', allowPrerelease: false });
	});

	it('only differs between SDK bands by the rules each band has, the SDK pin, preview prereleases and the header', () => {
		const [newer, older] = readBands();
		const olderCatalog = readCatalog(older.band);
		const newerCatalog = readCatalog(newer.band);
		const tfm = `net${older.channel}`;
		// Same target framework on both, so only the SDK band changes.
		const sameFrameworks = (bandConfig: ReturnType<typeof toPresetConfig>) => ({ ...bandConfig, scopes: bandConfig.scopes.map(scope => (scope.tfms ? { ...scope, tfms: [tfm] } : scope)) });
		const toLines = (bandName: string, bandCatalog: typeof catalog) =>
			toGeneratedOutput(sameFrameworks({ ...toPresetConfig({ level: 'recommended', kind: 'any' }, bandCatalog), versions: { sdkBand: bandName } }), bandCatalog, { commentStyle: 'none' })
				.files.flatMap(file => file.content.split('\n').map(line => `${file.path}: ${line}`))
				.filter(line => !line.includes('# Settings for .NET SDK') && !line.includes('"version":'));

		const olderLines = new Set(toLines(older.band, olderCatalog));
		const changedLines = toLines(newer.band, newerCatalog).filter(line => !olderLines.has(line));

		const isExpected = (line: string) => {
			if (newer.isPreview && line === 'global.json: \t\t"allowPrerelease": true') return true;
			const ruleId = /dotnet_diagnostic\.(\w+)\.severity/.exec(line)?.[1];
			return ruleId !== undefined && !olderCatalog.rules.has(ruleId);
		};

		expect(changedLines.filter(line => !isExpected(line))).toEqual([]);
	});
});

describe('Opinionated', () => {
	it('runs the trim and AOT analyzers as suggestions without declaring AOT compatibility', () => {
		const { file } = render({ level: 'opinionated', kind: 'library' });

		expect(file('src/Directory.Build.props')).toContain('<EnableTrimAnalyzer>true</EnableTrimAnalyzer>');
		expect(file('src/Directory.Build.props')).toContain('<EnableAotAnalyzer>true</EnableAotAnalyzer>');
		expect(file('src/Directory.Build.props')).not.toContain('IsAotCompatible');
		expect(file('src/.editorconfig')).toContain('dotnet_analyzer_diagnostic.category-Trimming.severity = suggestion');
		expect(file('src/.editorconfig')).toContain('dotnet_analyzer_diagnostic.category-AOT.severity = suggestion');
	});

	it('turns on the MSTest analyzers for tests, raising their suggestions to warnings', () => {
		const { config, file } = render({ level: 'opinionated', kind: 'any' });

		expect(config.scopes.find(scope => scope.path === 'tests')?.packages).toContain('MSTest.Analyzers');
		expect(file('tests/.editorconfig')).toMatch(/dotnet_diagnostic\.MSTEST\d+\.severity = warning/);
		expect(file('tests/Directory.Packages.props')).not.toContain('MSTest.Analyzers');
	});

	it('runs services with invariant globalization, and only services', () => {
		expect(render({ level: 'opinionated', kind: 'service' }).file('src/Directory.Build.props')).toContain('<InvariantGlobalization>true</InvariantGlobalization>');
		expect(render({ level: 'opinionated', kind: 'library' }).file('src/Directory.Build.props')).not.toContain('InvariantGlobalization');
		expect(render({ level: 'strict', kind: 'service' }).file('src/Directory.Build.props')).not.toContain('InvariantGlobalization');
	});

	it('embeds symbols in libraries instead of making a separate symbol package', () => {
		const props = render({ level: 'opinionated', kind: 'library' }).file('src/Directory.Build.props');

		expect(props).toContain('<IsPackable>true</IsPackable>');
		expect(props).not.toMatch(/IncludeSymbols|SymbolPackageFormat/);
		expect(props).toContain('<EmbedAllSources>true</EmbedAllSources>');
	});

	it('fails every build on warnings and uses the same analyzers as Strict', () => {
		const { file } = render({ level: 'opinionated', kind: 'any' });

		expect(file('Directory.Build.props')).toMatch(/Label="Warnings">\s*<!--[^>]*-->\s*<TreatWarningsAsErrors>true/);
		expect(file('Directory.Build.props')).toContain('<UseArtifactsOutput>true</UseArtifactsOutput>');
		expect(file('Directory.Build.props')).toContain('<DebugType>embedded</DebugType>');
		expect(JSON.parse(file('global.json')).test).toEqual({ runner: 'Microsoft.Testing.Platform' });
		expect(JSON.parse(file('global.json'))['msbuild-sdks']).toEqual({ 'MSTest.Sdk': catalog.packages.get('MSTest.Analyzers')?.version });
		for (const packageId of ['SonarAnalyzer.CSharp', 'Microsoft.VisualStudio.Threading.Analyzers', 'Meziantou.Analyzer']) {
			expect(file('Directory.Packages.props')).toContain(`Include="${packageId}"`);
		}
	});

	it('enforces tabs, this., var everywhere, pattern matching and primary constructors', () => {
		const editorConfig = render({ level: 'opinionated', kind: 'any' }).file('.editorconfig');

		expect(editorConfig).toContain('indent_style = tab');
		expect(editorConfig).toContain('dotnet_style_qualification_for_field = true');
		expect(editorConfig).toContain('csharp_style_var_elsewhere = true');
		expect(editorConfig).toContain('dotnet_diagnostic.IDE0009.severity = warning');
		expect(editorConfig).toContain('dotnet_diagnostic.IDE0078.severity = warning');
		expect(editorConfig).toContain('dotnet_diagnostic.IDE0290.severity = warning');
		expect(editorConfig).toContain('dotnet_diagnostic.CA2016.severity = error');
		expect(editorConfig).not.toContain('required_prefix = _');
	});
});
