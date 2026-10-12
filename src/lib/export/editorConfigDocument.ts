export type EditorConfigEntry = { comment?: string; key: string; value: string };

export type EditorConfigBlock = { heading?: string; entries: EditorConfigEntry[] };

/** A titled run of blocks inside a section, such as the diagnostic severities under `[*.cs]`. */
export type EditorConfigPart = { title?: string; blocks: EditorConfigBlock[] };

export type EditorConfigSection = { title: string; glob: string; parts: EditorConfigPart[] };

export type EditorConfigDocument = { headerComment?: string; isRoot: boolean; sections: EditorConfigSection[] };

/**
 * Renders a document with every comment on its own line. EditorConfig has no inline comments, so a trailing `# …`
 * would become part of the value.
 */
export function renderEditorConfig(document: EditorConfigDocument): string {
	const chunks: string[][] = [];
	const preamble = [...(document.headerComment ? [`# ${document.headerComment}`] : []), ...(document.isRoot ? ['root = true'] : [])];
	if (preamble.length > 0) chunks.push(preamble);

	for (const section of document.sections) {
		const parts = section.parts.map(part => ({ ...part, blocks: part.blocks.filter(block => block.entries.length > 0) })).filter(part => part.blocks.length > 0);
		if (parts.length === 0) continue;

		const sectionChunks = parts.flatMap(part => part.blocks.map((block, blockIndex) => toBlockLines(block, blockIndex === 0 ? part.title : undefined)));
		sectionChunks[0] = [`#### ${section.title} ####`, section.glob, ...sectionChunks[0]];
		chunks.push(...sectionChunks);
	}

	return `${chunks.map(lines => lines.join('\n')).join('\n\n')}\n`;
}

function toBlockLines(block: EditorConfigBlock, partTitle: string | undefined): string[] {
	const lines: string[] = [];
	if (partTitle) lines.push(`### ${partTitle} ###`);
	if (block.heading) lines.push(`## ${block.heading}`);

	for (const entry of block.entries) {
		if (entry.comment) lines.push(`# ${entry.comment}`);
		lines.push(`${entry.key} = ${entry.value}`);
	}

	return lines;
}
