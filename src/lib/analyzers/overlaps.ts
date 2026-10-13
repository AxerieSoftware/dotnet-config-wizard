import type { Catalog, CatalogRule } from '../catalog/catalog.ts';

/**
 * Rules from different analyzers that check the same thing. Each concern should have one active rule; rules from the
 * same analyzer as the owner, such as IDE0051 and IDE0052, cover different cases and aren't duplicates. A unit test checks
 * every ID exists.
 */
export const OVERLAPS: readonly { concern: string; ruleIds: string[] }[] = [
	{ concern: 'ConfigureAwait', ruleIds: ['CA2007', 'MA0004', 'VSTHRD111'] },
	{ concern: 'Forward CancellationToken', ruleIds: ['CA2016', 'MA0040'] },
	{ concern: 'Blocking calls in async methods', ruleIds: ['CA1849', 'MA0042', 'S6966', 'VSTHRD103'] },
	{ concern: 'async void methods', ruleIds: ['MA0155', 'S3168', 'VSTHRD100'] },
	{ concern: 'async void delegates', ruleIds: ['MA0147', 'VSTHRD101'] },
	{ concern: 'Unobserved async results', ruleIds: ['MA0134', 'VSTHRD110'] },
	{ concern: 'Returning a null Task', ruleIds: ['MA0022', 'VSTHRD114', 'S4586'] },
	{ concern: 'Rethrowing exceptions', ruleIds: ['CA2200', 'S3445'] },
	{ concern: 'Braces', ruleIds: ['IDE0011', 'S121'] },
	{ concern: 'StringComparison', ruleIds: ['CA1307', 'CA1310', 'MA0001'] },
	{ concern: 'Unused private members', ruleIds: ['IDE0051', 'IDE0052', 'S1144'] },
	{ concern: 'Unused parameters', ruleIds: ['IDE0060', 'S1172'] },
	{ concern: 'Unused assignments', ruleIds: ['IDE0059', 'S1854'] },
	{ concern: 'readonly fields', ruleIds: ['IDE0044', 'S2933'] },
	{ concern: 'Static members', ruleIds: ['CA1822', 'S2325'] },
	{ concern: 'Sealed types', ruleIds: ['CA1852', 'MA0053', 'S3260'] },
	{ concern: 'Regex timeouts', ruleIds: ['MA0009', 'S6444'] },
	{ concern: 'TODO comments', ruleIds: ['MA0026', 'S1135'] },
	{ concern: 'Redundant parentheses', ruleIds: ['IDE0047', 'S1110'] },
	{ concern: 'Async suffix', ruleIds: ['MA0137', 'VSTHRD200'] },
	{ concern: 'Catching general exceptions', ruleIds: ['CA1031', 'S2221'] },
	{ concern: 'Logger type matches its class', ruleIds: ['MA0180', 'S6672'] },
	{ concern: 'Argument exception parameter names', ruleIds: ['CA2208', 'S3928'] },
	{ concern: 'Redundant default initialization', ruleIds: ['CA1805', 'S3052'] },
	{ concern: 'Static members on generic types', ruleIds: ['CA1000', 'MA0018'] },
	{ concern: 'Constructors on abstract types', ruleIds: ['CA1012', 'MA0017', 'S3442'] },
	{ concern: 'AttributeUsage on attributes', ruleIds: ['CA1018', 'MA0010', 'S3993'] },
	{ concern: 'Types in namespaces', ruleIds: ['CA1050', 'MA0047'] },
	{ concern: 'Implementing IDisposable', ruleIds: ['CA1063', 'S3881'] },
	{ concern: 'Equals(object) alongside IEquatable<T>', ruleIds: ['CA1067', 'MA0095'] },
	{ concern: 'IEquatable<T> alongside Equals', ruleIds: ['CA1066', 'S3897'] },
	{ concern: 'Parameter names match the base', ruleIds: ['CA1725', 'S927'] },
	{ concern: 'PascalCase log placeholders', ruleIds: ['CA1727', 'S6678'] },
	{ concern: 'Empty finalizers', ruleIds: ['CA1821', 'S3880'] },
	{ concern: 'Any() over Count()', ruleIds: ['CA1827', 'S1155'] },
	{ concern: 'Count or Length over Any()', ruleIds: ['CA1860', 'MA0112'] },
	{ concern: 'char overloads', ruleIds: ['CA1865', 'CA1866', 'CA1867', 'S6610'] },
	{ concern: 'Locking on weak identity', ruleIds: ['CA2002', 'S3998'] },
	{ concern: 'Consuming ValueTask', ruleIds: ['CA2012', 'S5034'] },
	{ concern: 'Throwing reserved exceptions', ruleIds: ['CA2201', 'MA0012', 'S112'] },
	{ concern: 'Visible static fields', ruleIds: ['CA2211', 'MA0069', 'S2223'] },
	{ concern: 'Overridable calls in constructors', ruleIds: ['CA2214', 'MA0056', 'S1699'] },
	{ concern: 'readonly members', ruleIds: ['IDE0251', 'MA0102'] },
	{ concern: 'System.Threading.Lock', ruleIds: ['IDE0330', 'MA0158'] },
	{ concern: 'Empty arrays', ruleIds: ['CA1825', 'MA0005'] },
	{ concern: 'Ignored return values', ruleIds: ['CA1806', 'MA0060'] },
	{ concern: 'Changed parameter defaults in overrides', ruleIds: ['MA0061', 'S1006'] },
	{ concern: 'Flags on non-flags enums', ruleIds: ['MA0062', 'S4070'] },
	{ concern: 'Where before OrderBy', ruleIds: ['MA0063', 'S6607'] },
	{ concern: 'Obsolete messages', ruleIds: ['MA0070', 'S1123'] },
	{ concern: 'NaN comparisons', ruleIds: ['MA0082', 'S2688'] },
	{ concern: 'ConstructorArgument parameters', ruleIds: ['MA0083', 'S4260'] },
	{ concern: 'Unsubscribing anonymous delegates', ruleIds: ['MA0085', 'S3244'] },
	{ concern: 'Exceptions from unexpected places', ruleIds: ['CA1065', 'MA0086', 'S1048', 'S3877'] },
	{ concern: 'DefaultParameterValue with Optional', ruleIds: ['MA0087', 'S3450'] },
	{ concern: 'DefaultValue meant as DefaultParameterValue', ruleIds: ['MA0088', 'S3451'] },
	{ concern: 'string.Create over FormattableString', ruleIds: ['MA0111', 'S6618'] },
	{ concern: 'DateTime.UnixEpoch', ruleIds: ['MA0113', 'S6588'] },
	{ concern: 'ThrowIfNull on non-nullable values', ruleIds: ['CA2264', 'MA0131'] },
	{ concern: 'Static field initialization order', ruleIds: ['MA0195', 'S3263'] },
	{ concern: 'Virtual events', ruleIds: ['CA1070', 'S2290'] },
	{ concern: 'Static fields initialized inline', ruleIds: ['CA1810', 'S3963'] },
	{ concern: 'Awaiting tasks in using', ruleIds: ['VSTHRD107', 'MA0129'] },
	{ concern: 'Invalid regular expressions', ruleIds: ['MA0220', 'S5856'] },
	{ concern: 'Hiding base methods', ruleIds: ['CA1061', 'S4019'] },
	{ concern: 'Unused internal types', ruleIds: ['CA1812', 'MA0182'] },
	{ concern: 'Testing for empty strings', ruleIds: ['CA1820', 'S3256'] },
	{ concern: 'ThreadStatic initialization', ruleIds: ['CA2019', 'S2996'] },
	{ concern: 'Weak cryptography', ruleIds: ['CA5350', 'CA5351', 'S4790'] },
	{ concern: 'Static holder types', ruleIds: ['CA1052', 'MA0036', 'S1118'] },
	{ concern: 'Equals with GetHashCode', ruleIds: ['CS0659', 'S1206'] },
	{ concern: 'Unused local variables', ruleIds: ['CS0168', 'CS0219', 'S1481'] },
	{ concern: 'Unread private fields', ruleIds: ['IDE0052', 'S4487'] },
	{ concern: 'Fields never assigned', ruleIds: ['CS0649', 'S3459'] },
	{ concern: 'Empty statements', ruleIds: ['MA0037', 'S1116'] },
	{ concern: 'Redundant casts', ruleIds: ['IDE0004', 'S1905'] },
	{ concern: 'Redundant boolean literals', ruleIds: ['IDE0100', 'S1125'] },
	{ concern: 'Duplicate casts', ruleIds: ['IDE0020', 'S3247'] },
	{ concern: 'const over static readonly', ruleIds: ['CA1802', 'S3962'] },
	{ concern: 'Redundant default arguments', ruleIds: ['MA0108', 'S3254'] },
	{ concern: 'Collection methods over LINQ', ruleIds: ['MA0020', 'S6602', 'S6603', 'S6605'] },
	{ concern: 'Identical operands', ruleIds: ['MA0172', 'S1764'] },
	{ concern: 'Negated boolean checks', ruleIds: ['MA0213', 'S1940'] },
	{ concern: 'Lambda parameters over closures in ConcurrentDictionary', ruleIds: ['MA0105', 'S6612'] },
	{ concern: 'ASP.NET request validation', ruleIds: ['CA5363', 'S5753'] },
	{ concern: 'Simpler LINQ', ruleIds: ['IDE0120', 'IDE0121', 'S2971'] }
];

// When two analyzers check the same thing, the one earlier in this list keeps it: Microsoft's analyzers come first.
const OWNER_ORDER = [
	'Microsoft.CodeAnalysis.CSharp',
	'Microsoft.CodeAnalysis.NetAnalyzers',
	'Microsoft.CodeAnalysis.CSharp.CodeStyle',
	'Microsoft.VisualStudio.Threading.Analyzers',
	'Meziantou.Analyzer',
	'SonarAnalyzer.CSharp'
];

export type ActiveOverlap = { concern: string; owner: CatalogRule; duplicates: CatalogRule[] };

/** Concerns where more than one rule is active, with the rule that should keep the concern by the owner order. */
export function findActiveOverlaps(catalog: Catalog, isActive: (rule: CatalogRule) => boolean): ActiveOverlap[] {
	return OVERLAPS.flatMap(overlap => {
		const members = overlap.ruleIds.map(id => catalog.rules.get(id)).filter(rule => rule !== undefined);
		const active = members.filter(isActive).sort((left, right) => toOwnerRank(left) - toOwnerRank(right) || left.id.localeCompare(right.id));
		if (active.length === 0) return [];

		const [owner] = active;
		const duplicates = active.filter(rule => toSourceKey(rule) !== toSourceKey(owner));
		return duplicates.length > 0 ? [{ concern: overlap.concern, owner, duplicates }] : [];
	});
}

/** Each inactive rule whose concern another analyzer's active rule already covers, mapped to that rule's ID. */
export function findCoveringRuleIds(catalog: Catalog, isActive: (rule: CatalogRule) => boolean): Map<string, string> {
	return new Map(
		OVERLAPS.flatMap(overlap => {
			const members = overlap.ruleIds.map(id => catalog.rules.get(id)).filter(rule => rule !== undefined);
			const owner = members.filter(isActive).sort((left, right) => toOwnerRank(left) - toOwnerRank(right))[0];
			if (!owner) return [];

			return members.filter(rule => !isActive(rule) && toSourceKey(rule) !== toSourceKey(owner)).map(rule => [rule.id, owner.id] as const);
		})
	);
}

function toSourceKey(rule: CatalogRule): string {
	return rule.packageId ?? rule.source;
}

function toOwnerRank(rule: CatalogRule): number {
	const index = OWNER_ORDER.indexOf(toSourceKey(rule));
	return index === -1 ? OWNER_ORDER.length : index;
}
