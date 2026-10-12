import type { EditorConfigBlock } from '../export/editorConfigDocument.ts';

/** The file name the props wire in through GlobalAnalyzerConfigFiles; not `.globalconfig`, which the SDK also picks up on its own. */
export const GLOBAL_CONFIG_FILE = 'Analyzers.globalconfig';

/**
 * Renders a global AnalyzerConfig file of severities. Unlike `.editorconfig` it applies per project, not per path, and
 * `global_level = 100` lets it override the SDK's AnalysisLevel files, which sit at -100.
 */
export function toGlobalConfig(blocks: readonly EditorConfigBlock[]): string {
	const lines = ['is_global = true', 'global_level = 100'];
	for (const block of blocks) {
		lines.push('', ...(block.heading ? [`## ${block.heading}`] : []));
		for (const entry of block.entries) lines.push(...(entry.comment ? [`# ${entry.comment}`] : []), `${entry.key} = ${entry.value}`);
	}

	return `${lines.join('\n')}\n`;
}
