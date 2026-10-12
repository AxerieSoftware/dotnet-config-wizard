import type { BandEntry, SdkCatalogFile, StyleOptionCatalogFile, StyleOptionEntry } from './catalogFiles.ts';
import { OPTION_GROUPS } from './optionGroups.ts';
import { MINIMUM_CSHARP_VERSIONS, MINIMUM_TARGET_FRAMEWORKS } from './versionOverlay.ts';

const CODE_STYLE_SOURCE = 'Microsoft.CodeAnalysis.CSharp.CodeStyle';
const STYLE_RULES_URL = 'https://learn.microsoft.com/dotnet/fundamentals/code-analysis/style-rules';

export type CatalogRule = {
	id: string;
	source: string;
	title: string;
	category: string;
	helpLink: string | null;
	/** False for the IDE rules dotnet/docs documents but the SDK never runs; they only show in the editor. */
	isEnforcedOnBuild: boolean;
	minimumCSharpVersion: string | null;
	/** The oldest target framework that has the APIs the rule suggests, such as `net9.0`. */
	minimumTargetFramework: string | null;
};

export type CatalogOption = StyleOptionEntry & { groupTitle: string; groupOrder: number };

export type Catalog = {
	band: BandEntry;
	rules: ReadonlyMap<string, CatalogRule>;
	options: ReadonlyMap<string, CatalogOption>;
};

/** Combines one SDK band's rules with the dotnet/docs style options into the lookup the generators use. */
export function createCatalog(band: BandEntry, sdkCatalog: SdkCatalogFile, styleOptionCatalog: StyleOptionCatalogFile): Catalog {
	const ruleDocs = new Map(styleOptionCatalog.rules.map(ruleDoc => [ruleDoc.id, ruleDoc]));
	const rules = new Map<string, CatalogRule>();

	for (const rule of sdkCatalog.rules) {
		rules.set(rule.id, {
			id: rule.id,
			source: rule.source,
			title: rule.title,
			category: rule.category,
			helpLink: rule.helpLink,
			isEnforcedOnBuild: true,
			minimumCSharpVersion: MINIMUM_CSHARP_VERSIONS[rule.id] ?? ruleDocs.get(rule.id)?.minimumCSharpVersion ?? null,
			minimumTargetFramework: MINIMUM_TARGET_FRAMEWORKS[rule.id] ?? null
		});
	}

	for (const ruleDoc of styleOptionCatalog.rules) {
		if (rules.has(ruleDoc.id)) continue;

		rules.set(ruleDoc.id, {
			id: ruleDoc.id,
			source: CODE_STYLE_SOURCE,
			title: ruleDoc.title,
			category: ruleDoc.category,
			helpLink: `${STYLE_RULES_URL}/${ruleDoc.docFile.replace(/\.md$/, '')}`,
			isEnforcedOnBuild: false,
			minimumCSharpVersion: MINIMUM_CSHARP_VERSIONS[ruleDoc.id] ?? ruleDoc.minimumCSharpVersion,
			minimumTargetFramework: MINIMUM_TARGET_FRAMEWORKS[ruleDoc.id] ?? null
		});
	}

	const options = new Map<string, CatalogOption>();
	for (const option of styleOptionCatalog.options) {
		const groupOrder = OPTION_GROUPS.findIndex(group => group.docsGroups.includes(option.group));
		const groupTitle = groupOrder === -1 ? option.group : OPTION_GROUPS[groupOrder].title;
		options.set(option.name, { ...option, groupTitle, groupOrder: groupOrder === -1 ? OPTION_GROUPS.length : groupOrder });
	}

	return { band, rules, options };
}
