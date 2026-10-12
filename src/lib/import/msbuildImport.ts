import { BUILD_PROPERTIES_BY_NAME } from '../build/buildProperties.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { isSupportedTargetFramework } from '../config/targetFrameworks.ts';
import type { Severity } from '../config/wizardConfig.ts';
import { type ImportNote, type ImportResult, toUnmaintainedNotes } from './importResult.ts';

const PROPERTY_GROUP = /<PropertyGroup(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/PropertyGroup>/g;
const PROPERTY = /<(?<name>\w+)(?:\s[^>]*)?>(?<value>[^<]*)<\/\k<name>>/g;
const PACKAGE_ITEM = /<(?:Global)?Package(?:Reference|Version)\s[^>]*Include="(?<id>[^"]+)"/g;
const CI_CONDITION = /ContinuousIntegrationBuild|\$\(CI\)|TF_BUILD|GITHUB_ACTIONS/;
const UNMAINTAINED_PACKAGES = ['StyleCop.Analyzers', 'SecurityCodeScan', 'SecurityCodeScan.VS2019', 'IDisposableAnalyzers', 'AsyncFixer'];
const DROPPED_PROPERTIES: Readonly<Record<string, string>> = {
	LangVersion: 'the C# version follows the target framework, as Microsoft recommends',
	WarningLevel: 'warning waves follow AnalysisLevel',
	ContinuousIntegrationBuild: 'the wizard sets it from the CI and TF_BUILD environment variables',
	CodeAnalysisRuleSet: 'rule sets are legacy; import the .ruleset file to convert it',
	PackageLicenseUrl: 'it is deprecated; use PackageLicenseExpression',
	PackageIconUrl: 'it is deprecated; use PackageIcon'
};

/**
 * Reads `Directory.Build.props` or `Directory.Packages.props` with pattern matching rather than a full MSBuild
 * evaluation: properties in unconditional groups, CI-conditioned groups as CI-only properties, and analyzer packages.
 */
export function importMsBuildFile(text: string, catalog: Catalog): ImportResult {
	const settings: ImportResult['settings'] = {};
	const notes: ImportNote[] = [];
	const unsupported = new Set<string>();
	let skippedConditionCount = 0;

	for (const group of text.matchAll(PROPERTY_GROUP)) {
		const condition = /Condition="(?<condition>[^"]*)"/.exec(group.groups?.attributes ?? '')?.groups?.condition;
		const isCiOnly = condition !== undefined && CI_CONDITION.test(condition);
		if (condition && !isCiOnly) {
			skippedConditionCount++;
			continue;
		}

		for (const property of (group.groups?.body ?? '').matchAll(PROPERTY)) {
			const name = property.groups?.name ?? '';
			const value = (property.groups?.value ?? '').trim();
			notes.push(...importProperty(name, value, isCiOnly, settings, unsupported));
		}
	}

	const packageIds = [...text.matchAll(PACKAGE_ITEM)].map(match => match.groups?.id ?? '');
	const analyzerPackages = packageIds.filter(id => catalog.packages.has(id));
	if (analyzerPackages.length > 0) settings.packages = analyzerPackages;
	const unmaintained = packageIds.filter(id => UNMAINTAINED_PACKAGES.includes(id));
	if (unmaintained.length > 0) notes.push({ severity: 'warning', message: `${unmaintained.join(', ')} are no longer maintained, so the wizard doesn't reference them.` });

	if (skippedConditionCount > 0) notes.push({ severity: 'info', message: `Skipped ${skippedConditionCount} conditional property groups; only unconditional and CI-only settings are imported.` });
	if (unsupported.size > 0) notes.push({ severity: 'info', message: `${[...unsupported].join(', ')} aren't properties the wizard writes, so they were dropped.` });
	return { settings, notes };
}

function importProperty(name: string, value: string, isCiOnly: boolean, settings: ImportResult['settings'], unsupported: Set<string>): ImportNote[] {
	if (DROPPED_PROPERTIES[name]) {
		const severity = name === 'PackageLicenseUrl' || name === 'PackageIconUrl' ? 'error' : 'info';
		return [{ severity, message: `${name} was dropped: ${DROPPED_PROPERTIES[name]}.` }];
	}

	if (name === 'NoWarn') {
		const ruleIds = toListEntries(value, name).map(id => (/^\d+$/.test(id) ? `CS${id.padStart(4, '0')}` : id));
		settings.severities = { ...settings.severities, ...Object.fromEntries(ruleIds.map(id => [id, 'none' as Severity])) };
		return [{ severity: 'info', message: `NoWarn ${ruleIds.join(', ')} became severity none in .editorconfig, where suppressions belong.` }, ...toUnmaintainedNotes(ruleIds)];
	}

	if (name === 'TargetFramework' || name === 'TargetFrameworks') {
		const tfms = toListEntries(value, name);
		settings.tfms = tfms.filter(isSupportedTargetFramework);
		const unsupportedTfms = tfms.filter(tfm => !isSupportedTargetFramework(tfm));
		return [
			{ severity: 'info', message: `${name} became this folder's target frameworks; shared props don't set it, so each project keeps its own.` },
			...(unsupportedTfms.length > 0 ? [{ severity: 'warning' as const, message: `${unsupportedTfms.join(', ')} were dropped; the wizard supports .NET 10 and later only.` }] : [])
		];
	}

	const property = BUILD_PROPERTIES_BY_NAME.get(name);
	if (!property) {
		unsupported.add(name);
		return [];
	}

	const importedValue = property.isList ? toListEntries(value, name).join(';') : value;
	if (isCiOnly && property.canBeCiOnly) settings.ciBuild = { ...settings.ciBuild, [name]: importedValue };
	else settings.build = { ...settings.build, [name]: importedValue };
	return [];
}

/** Splits a semicolon or comma list, dropping the `$(Name)` that appends to an inherited value. */
function toListEntries(value: string, name: string): string[] {
	return value
		.split(/[;,]/)
		.map(entry => entry.trim())
		.filter(entry => entry !== '' && entry !== `$(${name})`);
}
