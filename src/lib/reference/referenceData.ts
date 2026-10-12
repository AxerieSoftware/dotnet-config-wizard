import { OVERLAPS } from '../analyzers/overlaps.ts';
import type { Catalog, CatalogOption, CatalogRule } from '../catalog/catalog.ts';
import { BANDS, loadCatalog } from '../catalog/loadCatalog.ts';

const STYLE_RULES_URL = 'https://learn.microsoft.com/dotnet/fundamentals/code-analysis/style-rules';

export type RuleReference = {
	rule: CatalogRule;
	/** SDK bands that have the rule, newest first. */
	bands: string[];
	firstSeen: string | undefined;
	options: { name: string; groupTitle: string }[];
	duplicateConcerns: { concern: string; otherRuleIds: string[] }[];
};

export type OptionReference = { option: CatalogOption; rules: { id: string; title: string }[]; docsUrl: string };

/** Every band's catalog, newest supported release first, so a rule's page describes the newest release that has it. */
async function loadReferenceCatalogs(): Promise<Catalog[]> {
	const catalogs = await Promise.all(BANDS.map(band => loadCatalog(band.band)));
	return catalogs.sort((left, right) => Number(left.band.isPreview) - Number(right.band.isPreview));
}

export async function listRules(): Promise<CatalogRule[]> {
	const rules = new Map<string, CatalogRule>();
	for (const catalog of await loadReferenceCatalogs()) for (const rule of catalog.rules.values()) if (!rules.has(rule.id)) rules.set(rule.id, rule);
	return [...rules.values()].sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
}

export async function listOptions(): Promise<CatalogOption[]> {
	const [catalog] = await loadReferenceCatalogs();
	return [...catalog.options.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function findRule(id: string): Promise<RuleReference | undefined> {
	const catalogs = await loadReferenceCatalogs();
	const owningCatalog = catalogs.find(catalog => catalog.rules.has(id));
	const rule = owningCatalog?.rules.get(id);
	if (!owningCatalog || !rule) return undefined;

	return {
		rule,
		bands: catalogs.filter(catalog => catalog.rules.has(id)).map(catalog => catalog.band.band),
		firstSeen: owningCatalog.history.get(id),
		options: [...owningCatalog.options.values()].filter(option => option.ruleIds.includes(id)).map(option => ({ name: option.name, groupTitle: option.groupTitle })),
		duplicateConcerns: OVERLAPS.filter(overlap => overlap.ruleIds.includes(id) || (rule.packageId !== null && (overlap.packageIds ?? []).includes(rule.packageId))).map(overlap => ({
			concern: overlap.concern,
			otherRuleIds: overlap.ruleIds.filter(otherId => otherId !== id)
		}))
	};
}

export async function findOption(name: string): Promise<OptionReference | undefined> {
	const [catalog] = await loadReferenceCatalogs();
	const option = catalog.options.get(name);
	if (!option) return undefined;

	return {
		option,
		rules: option.ruleIds.map(id => ({ id, title: catalog.rules.get(id)?.title ?? id })),
		docsUrl: toDocsUrl(option, catalog)
	};
}

/** Options documented on an IDE rule page or a formatting page link there; ones from shared include files link to their first rule's page. */
function toDocsUrl(option: CatalogOption, catalog: Catalog): string {
	const isPage = option.docFile.startsWith('ide') || option.docFile.endsWith('-formatting-options.md');
	const firstRuleLink = option.ruleIds.map(id => catalog.rules.get(id)?.helpLink).find(link => link);
	return isPage || !firstRuleLink ? `${STYLE_RULES_URL}/${option.docFile.replace(/\.md$/, '')}` : firstRuleLink;
}
