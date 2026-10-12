import type { Catalog, CatalogOption } from '../catalog/catalog.ts';
import { type GateContext, getOptionBlocker } from '../config/versionGates.ts';
import type { EditorConfigBlock } from '../export/editorConfigDocument.ts';
import type { SkippedKey } from '../export/generatedFile.ts';

const CSHARP_LANGUAGE = 'csharp';

export type CodeStyleBlocks = { blocks: EditorConfigBlock[]; skippedKeys: SkippedKey[] };

/** Groups the configured code-style options by their catalog group, headed by the rules the options feed. */
export function toCodeStyleBlocks(options: Record<string, string>, catalog: Catalog, context: GateContext): CodeStyleBlocks {
	const skippedKeys: SkippedKey[] = [];
	const configured: { option: CatalogOption; value: string }[] = [];

	for (const [name, value] of Object.entries(options)) {
		const option = catalog.options.get(name);
		if (!option?.languages.includes(CSHARP_LANGUAGE)) {
			skippedKeys.push({ key: name, reason: 'Not a C# option the catalog knows' });
			continue;
		}

		const blocker = getOptionBlocker(option, context);
		if (blocker) {
			skippedKeys.push({ key: name, reason: blocker });
			continue;
		}

		configured.push({ option, value });
	}

	configured.sort((left, right) => left.option.groupOrder - right.option.groupOrder || left.option.name.localeCompare(right.option.name));

	const blocks = Map.groupBy(configured, entry => entry.option.groupTitle)
		.values()
		.map(entries => ({
			heading: toHeading(
				entries[0].option.groupTitle,
				entries.map(entry => entry.option)
			),
			entries: entries.map(entry => ({ key: entry.option.name, value: entry.value }))
		}))
		.toArray();

	return { blocks, skippedKeys };
}

function toHeading(groupTitle: string, options: CatalogOption[]): string {
	const ruleIds = [...new Set(options.flatMap(option => option.ruleIds))].sort();
	return ruleIds.length === 0 ? groupTitle : `${groupTitle} (${ruleIds.join(', ')})`;
}
