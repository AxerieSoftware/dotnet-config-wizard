import { BUILD_PROPERTIES_BY_NAME, PROJECT_NAME_CONDITION } from '../build/buildProperties.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { isSupportedTargetFramework } from '../config/targetFrameworks.ts';
import type { Severity } from '../config/wizardConfig.ts';
import { type ImportNote, type ImportResult, toUnmaintainedNotes } from './importResult.ts';

const PROPERTY_GROUP = /<PropertyGroup(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/PropertyGroup>/g;
const PROPERTY = /<(?<name>\w+)(?<attributes>\s[^>]*)?>(?<value>[^<]*)<\/\k<name>>/g;
const CONDITION = /Condition="(?<condition>[^"]*)"/;
// Compiler warnings can be written as bare numbers in NoWarn, such as 1591 for CS1591.
const COMPILER_WARNING = /^(?:CS)?\d+$/;
const PACKAGE_ITEM = /<(?:Global)?Package(?:Reference|Version)\s[^>]*Include="(?<id>[^"]+)"/g;
const TEST_ACCESS_ITEM = /<InternalsVisibleTo\s[^>]*(?<action>Include|Remove)="\$\(AssemblyName\)\.Tests"/;
/** A condition that limits a group to CI builds. */
export const CI_CONDITION = /ContinuousIntegrationBuild|\$\(CI\)|TF_BUILD|GITHUB_ACTIONS/;
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
		const condition = CONDITION.exec(group.groups?.attributes ?? '')?.groups?.condition;
		const projectNamePrefix = condition === undefined ? undefined : PROJECT_NAME_CONDITION.exec(condition)?.groups?.prefix;
		if (projectNamePrefix) {
			settings.projectNamePrefix = projectNamePrefix;
			continue;
		}

		const isCiOnly = condition !== undefined && CI_CONDITION.test(condition);
		if (condition && !isCiOnly) {
			skippedConditionCount++;
			continue;
		}

		for (const property of (group.groups?.body ?? '').matchAll(PROPERTY)) {
			// A condition on the property itself limits it the same way a group's does.
			const propertyCondition = CONDITION.exec(property.groups?.attributes ?? '')?.groups?.condition;
			const isPropertyCiOnly = propertyCondition !== undefined && CI_CONDITION.test(propertyCondition);
			if (propertyCondition && !isPropertyCiOnly) {
				skippedConditionCount++;
				continue;
			}

			const name = property.groups?.name ?? '';
			const value = (property.groups?.value ?? '').trim();
			notes.push(...importProperty(name, value, isCiOnly || isPropertyCiOnly, catalog, settings, unsupported));
		}
	}

	const testAccess = TEST_ACCESS_ITEM.exec(text)?.groups?.action;
	if (testAccess) settings.areInternalsVisibleToTests = testAccess === 'Include';

	const packageIds = [...text.matchAll(PACKAGE_ITEM)].map(match => match.groups?.id ?? '');
	const analyzerPackages = packageIds.filter(id => catalog.packages.has(id));
	if (analyzerPackages.length > 0) settings.packages = analyzerPackages;
	const unmaintained = packageIds.filter(id => UNMAINTAINED_PACKAGES.includes(id));
	if (unmaintained.length > 0) notes.push({ severity: 'warning', isDropped: true, message: `${unmaintained.join(', ')} are no longer maintained, so the wizard doesn't reference them.` });

	if (skippedConditionCount > 0)
		notes.push({ severity: 'info', isDropped: true, message: `Skipped ${skippedConditionCount} conditional properties or property groups; only unconditional and CI-only settings are imported.` });
	if (unsupported.size > 0) notes.push({ severity: 'info', isDropped: true, message: `${[...unsupported].join(', ')} aren't properties the wizard writes, so they were dropped.` });
	return { settings, notes };
}

function importProperty(name: string, value: string, isCiOnly: boolean, catalog: Catalog, settings: ImportResult['settings'], unsupported: Set<string>): ImportNote[] {
	if (DROPPED_PROPERTIES[name]) {
		const severity = name === 'PackageLicenseUrl' || name === 'PackageIconUrl' ? 'error' : 'info';
		// Deprecated package properties stay errors even when loading a repo keeps them in the file.
		return [{ severity, ...(severity === 'info' ? { isDropped: true } : {}), message: `${name} was dropped: ${DROPPED_PROPERTIES[name]}.` }];
	}

	if (name === 'NoWarn') {
		const ids = toListEntries(value, name).map(id => (/^\d+$/.test(id) ? `CS${id.padStart(4, '0')}` : id));
		// Only compiler and analyzer warnings can be suppressed from .editorconfig; NuGet and MSBuild ones can't.
		const ruleIds = ids.filter(id => COMPILER_WARNING.test(id) || catalog.rules.has(id));
		const otherIds = ids.filter(id => !ruleIds.includes(id));
		settings.severities = { ...settings.severities, ...Object.fromEntries(ruleIds.map(id => [id, 'none' as Severity])) };
		return [
			...(ruleIds.length > 0 ? [{ severity: 'info' as const, message: `NoWarn ${ruleIds.join(', ')} became severity none in .editorconfig, where suppressions belong.` }] : []),
			...(otherIds.length > 0 ? [{ severity: 'warning' as const, isDropped: true, message: `NoWarn ${otherIds.join(', ')} can't be set in .editorconfig, so keep them in NoWarn.` }] : []),
			...toUnmaintainedNotes(ruleIds)
		];
	}

	if (name === 'TargetFramework' || name === 'TargetFrameworks') {
		const tfms = toListEntries(value, name);
		settings.tfms = tfms.filter(isSupportedTargetFramework);
		const unsupportedTfms = tfms.filter(tfm => !isSupportedTargetFramework(tfm));
		settings.isTargetFrameworkShared = true;
		return [
			{ severity: 'info', message: `${name} is set for every project in this folder.` },
			...(unsupportedTfms.length > 0 ? [{ severity: 'warning' as const, isDropped: true, message: `${unsupportedTfms.join(', ')} were dropped; the wizard supports .NET 10 and later only.` }] : [])
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
