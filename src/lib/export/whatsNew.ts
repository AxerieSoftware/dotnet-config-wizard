import type { Catalog, CatalogRule } from '../catalog/catalog.ts';
import { type GateContext, getRuleBlocker } from '../config/versionGates.ts';

/**
 * Rules that joined the catalog after a config was made, judged by the catalog version in its `.editorconfig` header,
 * leaving out rules the scope's C# version or packages can't use.
 */
export function findRulesAddedSince(catalog: Catalog, sinceVersion: string, context: GateContext): CatalogRule[] {
	return catalog.rules
		.values()
		.filter(rule => (catalog.history.get(rule.id) ?? '') > sinceVersion && !getRuleBlocker(rule, context))
		.toArray()
		.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
}
