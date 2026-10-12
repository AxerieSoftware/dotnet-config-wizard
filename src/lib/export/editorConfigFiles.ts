import { type CommentStyle, toSeverityBlocks } from '../analyzers/severityBlocks.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { toCodeStyleBlocks } from '../codeStyle/codeStyleBlocks.ts';
import { resolveScope } from '../config/scopes.ts';
import { toGateContext } from '../config/versionGates.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import { CSHARP_GLOB, toCSharpFormattingEntries, toFormattingSections } from '../formatting/formattingSections.ts';
import { toNamingBlocks } from '../naming/namingBlocks.ts';
import { renderEditorConfig } from './editorConfigDocument.ts';
import type { GeneratedFile, GeneratedOutput, SkippedKey } from './generatedFile.ts';

const FILE_NAME = '.editorconfig';

export type EditorConfigOutputOptions = { commentStyle: CommentStyle };

/**
 * One `.editorconfig` per scope: the root file holds `root = true`, and nested files hold only what their scope
 * overrides. Each scope's keys are checked against that scope's own target frameworks. Scopes with nothing to say get no file.
 */
export function toEditorConfigFiles(config: WizardConfig, catalog: Catalog, outputOptions: EditorConfigOutputOptions): GeneratedOutput {
	const output: GeneratedOutput = { files: [], skippedKeys: [] };
	for (const scope of config.scopes) {
		const scopeOutput = toEditorConfigFile(config, scope, catalog, outputOptions);
		if (scopeOutput.file) output.files.push(scopeOutput.file);
		output.skippedKeys.push(...scopeOutput.skippedKeys.map(skipped => ({ ...skipped, scopePath: scope.path })));
	}

	return output;
}

function toEditorConfigFile(config: WizardConfig, scope: ScopeConfig, catalog: Catalog, outputOptions: EditorConfigOutputOptions): { file?: GeneratedFile; skippedKeys: SkippedKey[] } {
	const isRoot = scope.path === '';
	const context = toGateContext(config, resolveScope(config, scope), catalog);
	const codeStyle = toCodeStyleBlocks(scope.options ?? {}, catalog, context);
	const severities = toSeverityBlocks(scope.severities ?? {}, catalog, context, outputOptions.commentStyle);

	const sections = [
		...toFormattingSections(scope),
		{
			title: 'C# files',
			glob: CSHARP_GLOB,
			parts: [{ blocks: [{ entries: toCSharpFormattingEntries(scope) }, ...codeStyle.blocks, ...toNamingBlocks(scope.naming ?? [])] }, { title: 'Diagnostic severities', blocks: severities.blocks }]
		}
	];

	const skippedKeys = [...codeStyle.skippedKeys, ...severities.skippedKeys];
	const hasEntries = sections.some(section => section.parts.some(part => part.blocks.some(block => block.entries.length > 0)));
	if (!isRoot && !hasEntries) return { skippedKeys };

	const file = {
		path: isRoot ? FILE_NAME : `${scope.path}/${FILE_NAME}`,
		content: renderEditorConfig({ headerComment: isRoot ? `Settings for .NET SDK ${catalog.band.band}` : undefined, isRoot, sections })
	};
	return { file, skippedKeys };
}
