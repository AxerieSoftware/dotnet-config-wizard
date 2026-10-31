import type { BandEntry, PackageCatalogFile, PackageEntry, RuleParameter, SdkCatalogFile, SdkRuleEntry, StyleOptionCatalogFile, StyleOptionEntry } from './catalogFiles.ts';
import { OPTION_GROUPS } from './optionGroups.ts';
import { MINIMUM_CSHARP_VERSIONS } from './versionOverlay.ts';

const CODE_STYLE_SOURCE = 'Microsoft.CodeAnalysis.CSharp.CodeStyle';
const STYLE_RULES_URL = 'https://learn.microsoft.com/dotnet/fundamentals/code-analysis/style-rules';

/** Display names for the analyzers that ship with the SDK; packages use their own titles. */
export const SDK_SOURCE_TITLES: Readonly<Record<string, string>> = {
	'Microsoft.CodeAnalysis.CSharp': 'C# compiler',
	[CODE_STYLE_SOURCE]: 'Code style',
	'Microsoft.CodeAnalysis.NetAnalyzers': '.NET analyzers',
	'Microsoft.NET.ILLink.Tasks': 'Trim and AOT analyzers',
	'Microsoft.AspNetCore.App.Ref': 'ASP.NET Core analyzers'
};

export type CatalogRule = {
	id: string;
	source: string;
	sourceTitle: string;
	/** The NuGet package that has to be referenced for the rule to run, or null for rules that ship with the SDK. */
	packageId: string | null;
	title: string;
	category: string;
	helpLink: string | null;
	/** False for the IDE rules dotnet/docs documents but the SDK never runs; they only show in the editor. */
	isEnforcedOnBuild: boolean;
	minimumCSharpVersion: string | null;
	defaultSeverity: string;
	isEnabledByDefault: boolean;
	hasCodeFix: boolean;
	warningLevel: number | null;
	parameters: RuleParameter[];
};

export type CatalogOption = StyleOptionEntry & { groupTitle: string; groupOrder: number };

export type Catalog = {
	band: BandEntry;
	/** The date the newest rule first appeared; configs record it so a later catalog can list what's new since. */
	version: string;
	/** Rule ID to the date it first appeared in the catalog. */
	history: ReadonlyMap<string, string>;
	rules: ReadonlyMap<string, CatalogRule>;
	options: ReadonlyMap<string, CatalogOption>;
	packages: ReadonlyMap<string, PackageEntry>;
	/** Level, then mode, then rule ID to the severity the SDK's AnalysisLevel files give. Rules a mode doesn't list keep their own default. */
	analysisLevels: Readonly<Record<string, Record<string, Record<string, string>>>>;
};

/** Combines one SDK band's rules, the analyzer packages and the dotnet/docs style options into the lookup the generators use. */
export function createCatalog(
	band: BandEntry,
	sdkCatalog: SdkCatalogFile,
	styleOptionCatalog: StyleOptionCatalogFile,
	packages: PackageEntry[],
	packageCatalogs: PackageCatalogFile[],
	ruleHistory: Record<string, string>
): Catalog {
	const ruleDocs = new Map(styleOptionCatalog.rules.map(ruleDoc => [ruleDoc.id, ruleDoc]));
	const rules = new Map<string, CatalogRule>();

	for (const rule of sdkCatalog.rules) {
		const minimumCSharpVersion = MINIMUM_CSHARP_VERSIONS[rule.id] ?? ruleDocs.get(rule.id)?.minimumCSharpVersion ?? null;
		rules.set(rule.id, toCatalogRule(rule, SDK_SOURCE_TITLES[rule.source] ?? rule.source, null, minimumCSharpVersion));
	}

	for (const ruleDoc of styleOptionCatalog.rules) {
		if (rules.has(ruleDoc.id)) continue;

		rules.set(ruleDoc.id, {
			id: ruleDoc.id,
			source: CODE_STYLE_SOURCE,
			sourceTitle: SDK_SOURCE_TITLES[CODE_STYLE_SOURCE],
			packageId: null,
			title: ruleDoc.title,
			category: ruleDoc.category,
			helpLink: `${STYLE_RULES_URL}/${ruleDoc.docFile.replace(/\.md$/, '')}`,
			isEnforcedOnBuild: false,
			minimumCSharpVersion: MINIMUM_CSHARP_VERSIONS[ruleDoc.id] ?? ruleDoc.minimumCSharpVersion,
			defaultSeverity: 'silent',
			isEnabledByDefault: true,
			hasCodeFix: false,
			warningLevel: null,
			parameters: []
		});
	}

	const packagesById = new Map(packages.map(entry => [entry.id, entry]));
	for (const packageCatalog of packageCatalogs) {
		const title = packagesById.get(packageCatalog.id)?.title ?? packageCatalog.id;
		for (const rule of packageCatalog.rules) {
			// The SDK and earlier packages win when two sources report the same ID.
			if (!rules.has(rule.id)) rules.set(rule.id, toCatalogRule(rule, title, packageCatalog.id, null));
		}
	}

	const options = new Map<string, CatalogOption>();
	for (const option of styleOptionCatalog.options) {
		const groupOrder = OPTION_GROUPS.findIndex(group => group.docsGroups.includes(option.group));
		const groupTitle = groupOrder === -1 ? option.group : OPTION_GROUPS[groupOrder].title;
		options.set(option.name, { ...option, groupTitle, groupOrder: groupOrder === -1 ? OPTION_GROUPS.length : groupOrder });
	}

	const version = Object.values(ruleHistory).sort().at(-1) ?? '';
	return { band, version, history: new Map(Object.entries(ruleHistory)), rules, options, packages: packagesById, analysisLevels: sdkCatalog.analysisLevels };
}

function toCatalogRule(rule: SdkRuleEntry, sourceTitle: string, packageId: string | null, minimumCSharpVersion: string | null): CatalogRule {
	return {
		id: rule.id,
		source: rule.source,
		sourceTitle,
		packageId,
		title: rule.title,
		category: rule.category,
		helpLink: rule.helpLink,
		isEnforcedOnBuild: true,
		minimumCSharpVersion,
		defaultSeverity: rule.defaultSeverity,
		isEnabledByDefault: rule.isEnabledByDefault,
		hasCodeFix: rule.hasCodeFix,
		warningLevel: rule.warningLevel,
		parameters: rule.parameters
	};
}
