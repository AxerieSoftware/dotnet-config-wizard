import type { Catalog } from '../catalog/catalog.ts';
import type { Severity } from '../config/wizardConfig.ts';
import { type ImportResult, toUnmaintainedNotes } from './importResult.ts';

const RULE = /<Rule\s+Id="(?<id>[^"]+)"\s+Action="(?<action>[^"]+)"/g;
const ACTION_SEVERITIES: Readonly<Record<string, Severity>> = { Error: 'error', Warning: 'warning', Info: 'suggestion', Hidden: 'silent', None: 'none' };

/** Converts a legacy `.ruleset` into rule severities, which belong in .editorconfig now. */
export function importRuleSet(text: string, catalog: Catalog): ImportResult {
	const severities: Record<string, Severity> = {};
	const droppedIds: string[] = [];

	for (const rule of text.matchAll(RULE)) {
		const id = rule.groups?.id ?? '';
		const severity = ACTION_SEVERITIES[rule.groups?.action ?? ''];
		if (!severity) continue;
		if (catalog.rules.has(id)) severities[id] = severity;
		else droppedIds.push(id);
	}

	const unknownIds = droppedIds.filter(id => toUnmaintainedNotes([id]).length === 0);
	return {
		settings: { severities },
		notes: [
			{ severity: 'info', message: `Converted ${Object.keys(severities).length} rule set entries to .editorconfig severities. Remove CodeAnalysisRuleSet from your projects.` },
			...toUnmaintainedNotes(droppedIds),
			...(unknownIds.length > 0 ? [{ severity: 'warning' as const, message: `${unknownIds.join(', ')} aren't in SDK ${catalog.band.band} or the supported packages, so they were dropped.` }] : [])
		]
	};
}
