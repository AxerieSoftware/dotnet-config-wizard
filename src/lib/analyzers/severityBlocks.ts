import type { Catalog, CatalogRule } from '../catalog/catalog.ts';
import { type GateContext, getRuleBlocker } from '../config/versionGates.ts';
import type { Severity } from '../config/wizardConfig.ts';
import type { EditorConfigBlock } from '../export/editorConfigDocument.ts';
import type { SkippedKey } from '../export/generatedFile.ts';

export const COMMENT_STYLES = ['none', 'idAndTitle', 'titleAndLink'] as const;
export type CommentStyle = (typeof COMMENT_STYLES)[number];

// SDK analyzers come first in this order, then packages alphabetically.
const SOURCE_ORDER = ['Microsoft.CodeAnalysis.CSharp', 'Microsoft.CodeAnalysis.CSharp.CodeStyle', 'Microsoft.CodeAnalysis.NetAnalyzers', 'Microsoft.NET.ILLink.Tasks'];

export type SeverityBlocks = { blocks: EditorConfigBlock[]; skippedKeys: SkippedKey[] };

/** Groups severities by analyzer package, then category, each with an ID and title comment. */
export function toSeverityBlocks(severities: Record<string, Severity>, catalog: Catalog, context: GateContext, commentStyle: CommentStyle): SeverityBlocks {
	const skippedKeys: SkippedKey[] = [];
	const configured: { rule: CatalogRule; severity: Severity }[] = [];

	for (const [id, severity] of Object.entries(severities)) {
		const rule = catalog.rules.get(id);
		if (!rule) {
			skippedKeys.push({ key: id, reason: `Not in SDK ${catalog.band.band}` });
			continue;
		}

		const blocker = getRuleBlocker(rule, context);
		if (blocker) {
			skippedKeys.push({ key: id, reason: blocker });
			continue;
		}

		configured.push({ rule, severity });
	}

	configured.sort((left, right) => compareRules(left.rule, right.rule));

	const blocks = Map.groupBy(configured, entry => `${entry.rule.sourceTitle}\n${entry.rule.category}`)
		.values()
		.map(entries => ({
			heading: `${entries[0].rule.sourceTitle}: ${entries[0].rule.category}`,
			entries: entries.map(entry => ({ comment: toComment(entry.rule, commentStyle), key: `dotnet_diagnostic.${entry.rule.id}.severity`, value: entry.severity }))
		}))
		.toArray();

	return { blocks, skippedKeys };
}

function compareRules(left: CatalogRule, right: CatalogRule): number {
	return toSourceRank(left.source) - toSourceRank(right.source) || left.sourceTitle.localeCompare(right.sourceTitle) || left.category.localeCompare(right.category) || left.id.localeCompare(right.id);
}

function toSourceRank(source: string): number {
	const index = SOURCE_ORDER.indexOf(source);
	return index === -1 ? SOURCE_ORDER.length : index;
}

function toComment(rule: CatalogRule, commentStyle: CommentStyle): string | undefined {
	switch (commentStyle) {
		case 'none':
			return undefined;
		case 'idAndTitle':
			return toIdAndTitle(rule);
		case 'titleAndLink':
			return rule.helpLink ? `${toIdAndTitle(rule)} ${rule.helpLink}` : toIdAndTitle(rule);
	}
}

function toIdAndTitle(rule: CatalogRule): string {
	const title = `${rule.id}: ${rule.title.replaceAll(/\s+/g, ' ').trim().replace(/\.$/, '')}`;
	return rule.isEnforcedOnBuild ? title : `${title} (editor only)`;
}
