import type { SdkCatalogFile, StyleOptionCatalogFile, StyleOptionEntry } from './catalogFiles.ts';
import { OPTION_GROUPS } from './optionGroups.ts';

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
};

export type CatalogOption = StyleOptionEntry & { groupTitle: string; groupOrder: number };

export type Catalog = {
	sdkVersion: string;
	band: string;
	rules: ReadonlyMap<string, CatalogRule>;
	options: ReadonlyMap<string, CatalogOption>;
};

/** Combines one SDK band's rules with the dotnet/docs style options into the lookup the generators use. */
export function createCatalog(sdkCatalog: SdkCatalogFile, styleOptionCatalog: StyleOptionCatalogFile): Catalog {
	const rules = new Map<string, CatalogRule>();
	for (const rule of sdkCatalog.rules) {
		rules.set(rule.id, { id: rule.id, source: rule.source, title: rule.title, category: rule.category, helpLink: rule.helpLink, isEnforcedOnBuild: true });
	}

	for (const ruleDoc of styleOptionCatalog.rules) {
		if (rules.has(ruleDoc.id)) continue;

		rules.set(ruleDoc.id, {
			id: ruleDoc.id,
			source: CODE_STYLE_SOURCE,
			title: ruleDoc.title,
			category: ruleDoc.category,
			helpLink: `${STYLE_RULES_URL}/${ruleDoc.docFile.replace(/\.md$/, '')}`,
			isEnforcedOnBuild: false
		});
	}

	const options = new Map<string, CatalogOption>();
	for (const option of styleOptionCatalog.options) {
		const groupOrder = OPTION_GROUPS.findIndex(group => group.docsGroups.includes(option.group));
		const groupTitle = groupOrder === -1 ? option.group : OPTION_GROUPS[groupOrder].title;
		options.set(option.name, { ...option, groupTitle, groupOrder: groupOrder === -1 ? OPTION_GROUPS.length : groupOrder });
	}

	return { sdkVersion: sdkCatalog.sdkVersion, band: sdkCatalog.band, rules, options };
}
