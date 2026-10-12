import type { Catalog, CatalogRule } from '../catalog/catalog.ts';

/**
 * Rules from different analyzers that check the same thing. Each concern should have one active rule; rules from the
 * same analyzer as the owner, such as IDE0051 and IDE0052, cover different cases and aren't duplicates. Members can be
 * rule IDs or a whole package, for Roslynator's formatting rules that all duplicate IDE0055. A unit test checks every ID exists.
 */
export const OVERLAPS: readonly { concern: string; ruleIds: string[]; packageIds?: string[] }[] = [
	{ concern: 'ConfigureAwait', ruleIds: ['CA2007', 'MA0004', 'RCS1090'] },
	{ concern: 'Forward CancellationToken', ruleIds: ['CA2016', 'MA0040'] },
	{ concern: 'Blocking calls in async methods', ruleIds: ['CA1849', 'MA0042', 'S6966'] },
	{ concern: 'async void methods', ruleIds: ['MA0155', 'S3168'] },
	{ concern: 'Braces', ruleIds: ['IDE0011', 'RCS1001', 'RCS1003', 'RCS1007', 'S121'] },
	{ concern: 'StringComparison', ruleIds: ['CA1307', 'CA1310', 'MA0001'] },
	{ concern: 'Unused private members', ruleIds: ['IDE0051', 'IDE0052', 'S1144', 'RCS1213'] },
	{ concern: 'Unused parameters', ruleIds: ['IDE0060', 'S1172', 'RCS1163'] },
	{ concern: 'Unused assignments', ruleIds: ['IDE0059', 'S1854', 'RCS1212'] },
	{ concern: 'readonly fields', ruleIds: ['IDE0044', 'S2933', 'RCS1169'] },
	{ concern: 'Static members', ruleIds: ['CA1822', 'S2325'] },
	{ concern: 'Sealed types', ruleIds: ['CA1852', 'MA0053', 'S3260'] },
	{ concern: 'Regex timeouts', ruleIds: ['MA0009', 'S6444'] },
	{ concern: 'TODO comments', ruleIds: ['MA0026', 'S1135'] },
	{ concern: 'Redundant parentheses', ruleIds: ['IDE0047', 'RCS1032', 'S1110'] },
	{ concern: 'Null propagation', ruleIds: ['IDE0031', 'RCS1146'] },
	{ concern: 'Async suffix', ruleIds: ['MA0137', 'RCS1046'] },
	{ concern: 'Catching general exceptions', ruleIds: ['CA1031', 'S2221'] },
	{ concern: 'Argument exception parameter names', ruleIds: ['CA2208', 'S3928'] },
	{ concern: 'Redundant default initialization', ruleIds: ['CA1805', 'S3052', 'RCS1129'] },
	{ concern: 'Formatting', ruleIds: ['IDE0055'], packageIds: ['Roslynator.Formatting.Analyzers'] }
];

// When two analyzers check the same thing, the one earlier in this list keeps it.
const OWNER_ORDER = [
	'Microsoft.CodeAnalysis.CSharp',
	'Microsoft.CodeAnalysis.NetAnalyzers',
	'Microsoft.CodeAnalysis.CSharp.CodeStyle',
	'Meziantou.Analyzer',
	'SonarAnalyzer.CSharp',
	'Roslynator.Analyzers',
	'Roslynator.Formatting.Analyzers'
];

export type ActiveOverlap = { concern: string; owner: CatalogRule; duplicates: CatalogRule[] };

/** Concerns where more than one rule is active, with the rule that should keep the concern by the owner order. */
export function findActiveOverlaps(catalog: Catalog, isActive: (rule: CatalogRule) => boolean): ActiveOverlap[] {
	return OVERLAPS.flatMap(overlap => {
		const members = [
			...overlap.ruleIds.map(id => catalog.rules.get(id)).filter(rule => rule !== undefined),
			...catalog.rules.values().filter(rule => rule.packageId !== null && (overlap.packageIds ?? []).includes(rule.packageId))
		];
		const active = members.filter(isActive).sort((left, right) => toOwnerRank(left) - toOwnerRank(right) || left.id.localeCompare(right.id));
		if (active.length === 0) return [];

		const [owner] = active;
		const duplicates = active.filter(rule => toSourceKey(rule) !== toSourceKey(owner));
		return duplicates.length > 0 ? [{ concern: overlap.concern, owner, duplicates }] : [];
	});
}

function toSourceKey(rule: CatalogRule): string {
	return rule.packageId ?? rule.source;
}

function toOwnerRank(rule: CatalogRule): number {
	const index = OWNER_ORDER.indexOf(toSourceKey(rule));
	return index === -1 ? OWNER_ORDER.length : index;
}
