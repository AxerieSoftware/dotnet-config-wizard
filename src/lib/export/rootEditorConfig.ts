import { type CommentStyle, toSeverityBlocks } from '../analyzers/severityBlocks.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { toCodeStyleBlocks } from '../codeStyle/codeStyleBlocks.ts';
import { getRootScope, type WizardConfig } from '../config/wizardConfig.ts';
import { CSHARP_GLOB, toCSharpFormattingEntries, toFormattingSections } from '../formatting/formattingSections.ts';
import { renderEditorConfig } from './editorConfigDocument.ts';

export type EditorConfigOutputOptions = { commentStyle: CommentStyle };

/** A generated file, plus any configured keys the catalog doesn't know and that were left out. */
export type GeneratedFile = { path: string; content: string; skippedKeys: string[] };

export function toRootEditorConfig(config: WizardConfig, catalog: Catalog, outputOptions: EditorConfigOutputOptions): GeneratedFile {
	const scope = getRootScope(config);
	const codeStyle = toCodeStyleBlocks(scope.options ?? {}, catalog);
	const severities = toSeverityBlocks(scope.severities ?? {}, catalog, outputOptions.commentStyle);

	const content = renderEditorConfig({
		headerComment: `Settings for .NET SDK ${catalog.band}`,
		isRoot: true,
		sections: [
			...toFormattingSections(scope),
			{
				title: 'C# files',
				glob: CSHARP_GLOB,
				parts: [{ blocks: [{ entries: toCSharpFormattingEntries(scope) }, ...codeStyle.blocks] }, { title: 'Diagnostic severities', blocks: severities.blocks }]
			}
		]
	});

	return { path: '.editorconfig', content, skippedKeys: [...codeStyle.skippedKeys, ...severities.skippedKeys] };
}
