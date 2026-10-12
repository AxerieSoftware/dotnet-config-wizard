import { describe, expect, it } from 'vitest';
import { readBands, readCatalog } from '../../../scripts/readCatalog.ts';
import { parseAnalysisLevel } from '../analyzers/analysisLevel.ts';
import { getEffectiveSeverity, isReported } from '../analyzers/effectiveSeverity.ts';
import { findActiveOverlaps } from '../analyzers/overlaps.ts';
import { checkEditorConfigKeys } from '../export/checkEditorConfigKeys.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import { PRESET_IDS, type PresetId, toPresetConfig } from './presets.ts';
import { resolveScope } from './scopes.ts';

const BAND = '10.0.4xx';
const catalog = readCatalog(BAND);
const ANALYZING_PRESETS: readonly PresetId[] = ['recommended', 'strict', 'library', 'service'];

function render(presetId: PresetId, bandName = BAND) {
	const bandCatalog = readCatalog(bandName);
	const config = toPresetConfig(presetId, bandCatalog);
	const output = toGeneratedOutput(config, bandCatalog, { commentStyle: 'idAndTitle' });
	return { config, output, file: (path: string) => output.files.find(file => file.path === path)?.content ?? '' };
}

describe.each(readBands().map(band => band.band))('every preset on SDK %s', bandName => {
	it.each(PRESET_IDS)('%s writes only keys Roslyn reads and leaves nothing out', presetId => {
		const { output } = render(presetId, bandName);

		expect(output.skippedKeys).toEqual([]);
		for (const file of output.files.filter(file => file.path.endsWith('.editorconfig'))) expect(checkEditorConfigKeys(file.content, readCatalog(bandName))).toEqual([]);
	});

	it.each(PRESET_IDS)('%s leaves exactly one active rule per concern in every folder', presetId => {
		const bandCatalog = readCatalog(bandName);
		const config = toPresetConfig(presetId, bandCatalog);

		for (const scope of config.scopes) {
			const resolved = resolveScope(config, scope);
			const overlaps = findActiveOverlaps(bandCatalog, rule => (!rule.packageId || resolved.packages.includes(rule.packageId)) && isReported(getEffectiveSeverity(rule, resolved, bandCatalog)));
			expect(overlaps).toEqual([]);
		}
	});

	it.each(PRESET_IDS)('%s never pairs TreatWarningsAsErrors with AnalysisMode all', presetId => {
		const { config } = render(presetId, bandName);

		for (const scope of config.scopes) {
			const resolved = resolveScope(config, scope);
			const isWarningsAsErrors = resolved.build.TreatWarningsAsErrors === 'true' || resolved.ciBuild.TreatWarningsAsErrors === 'true';
			expect(isWarningsAsErrors && parseAnalysisLevel(resolved.build.AnalysisLevel, readCatalog(bandName).band).mode === 'all').toBe(false);
		}
	});
});

describe('C1: consistent style across developers', () => {
	it.each(ANALYZING_PRESETS)('%s enforces code style on build with line endings Git respects', presetId => {
		const { file } = render(presetId);

		expect(file('.editorconfig')).toContain('root = true');
		expect(file('.gitattributes')).toContain('* text=auto eol=lf');
		expect(file('Directory.Build.props')).toContain('<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>');
		expect(file('.editorconfig')).toContain('dotnet_diagnostic.IDE0055.severity = warning');
		expect(file('.editorconfig')).toContain('dotnet_diagnostic.IDE0005.severity = warning');
		expect(file('Directory.Build.props')).toContain('<GenerateDocumentationFile>true</GenerateDocumentationFile>');
		expect(file('.editorconfig')).toContain('dotnet_diagnostic.IDE0076.severity = error');
	});

	it('fails CI builds on warnings in Recommended, every build in Strict, and never in Microsoft defaults', () => {
		expect(render('recommended').file('Directory.Build.props')).toMatch(/Label="CI builds only"[\s\S]*<TreatWarningsAsErrors>true/);
		expect(render('strict').file('Directory.Build.props')).toMatch(/Label="Warnings">\s*<!--[^>]*-->\s*<TreatWarningsAsErrors>true/);
		expect(render('microsoft-defaults').file('Directory.Build.props')).not.toContain('TreatWarningsAsErrors');
	});

	it('suppresses missing XML docs outside libraries only', () => {
		expect(render('service').file('.editorconfig')).toContain('dotnet_diagnostic.CS1591.severity = none');
		expect(render('library').file('.editorconfig')).not.toContain('dotnet_diagnostic.CS1591.severity = none');
	});
});

describe('C2: performance', () => {
	it('raises the Performance category and logging rules, more in Strict', () => {
		expect(render('recommended').file('.editorconfig')).toContain('dotnet_analyzer_diagnostic.category-Performance.severity = warning');
		expect(render('strict').file('.editorconfig')).toContain('dotnet_analyzer_diagnostic.category-Performance.severity = error');
		expect(render('strict').file('.editorconfig')).toContain('dotnet_diagnostic.CA1848.severity = error');
		expect(render('recommended').file('.editorconfig')).toContain('dotnet_diagnostic.CA1873.severity = warning');
	});

	it('asks for ConfigureAwait and AOT compatibility in libraries only', () => {
		expect(render('library').file('.editorconfig')).toContain('dotnet_diagnostic.CA2007.severity = warning');
		expect(render('library').file('Directory.Build.props')).toContain('<IsAotCompatible>true</IsAotCompatible>');
		expect(render('service').file('.editorconfig')).not.toContain('dotnet_diagnostic.CA2007.severity = warning');
		expect(render('service').file('Directory.Build.props')).not.toContain('IsAotCompatible');
		expect(render('library').file('tests/.editorconfig')).toContain('dotnet_diagnostic.CA2007.severity = none');
	});

	it('adds only the general async rules of the threading analyzers to Service', () => {
		const editorConfig = render('service').file('.editorconfig');

		expect(render('service').file('Directory.Packages.props')).toContain('Include="Microsoft.VisualStudio.Threading.Analyzers"');
		expect(editorConfig).toContain('dotnet_diagnostic.VSTHRD010.severity = none');
		expect(editorConfig).toContain('dotnet_diagnostic.VSTHRD100.severity = none');
		expect(editorConfig).not.toContain('dotnet_diagnostic.VSTHRD002.severity');
	});

	it("turns off Sonar's loop-to-LINQ rule in Strict", () => {
		expect(render('strict').file('.editorconfig')).toContain('dotnet_diagnostic.S3267.severity = none');
	});
});

describe('C3: security and supply chain', () => {
	it.each(ANALYZING_PRESETS)('%s makes security rules errors and locks down packages', presetId => {
		const { file } = render(presetId);

		expect(file('.editorconfig')).toContain('dotnet_analyzer_diagnostic.category-Security.severity = error');
		expect(file('.editorconfig')).toContain('dotnet_diagnostic.MA0009.severity = error');
		expect(file('Directory.Build.props')).toContain('<NuGetAuditMode>all</NuGetAuditMode>');
		expect(file('Directory.Build.props')).toContain('<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>');
		expect(file('Directory.Build.props')).toMatch(/Label="CI builds only"[\s\S]*<RestoreLockedMode>true/);
		expect(file('Directory.Packages.props')).toContain('<CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled>');
		expect(file('nuget.config')).toContain('<clear />');
		expect(file('BannedSymbols.txt')).toContain('P:System.DateTime.UtcNow;');
	});

	it('bans Console in libraries but not services', () => {
		expect(render('library').file('BannedSymbols.txt')).toContain('T:System.Console;');
		expect(render('service').file('BannedSymbols.txt')).not.toContain('T:System.Console;');
	});
});

describe('C4: new language features as they ship', () => {
	it.each(ANALYZING_PRESETS)('%s tracks the SDK and never pins the language', presetId => {
		const { file } = render(presetId);

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
			toGeneratedOutput(sameFrameworks({ ...toPresetConfig('recommended', bandCatalog), versions: { sdkBand: bandName } }), bandCatalog, { commentStyle: 'none' })
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
