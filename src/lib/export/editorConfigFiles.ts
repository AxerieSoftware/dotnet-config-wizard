import { type CommentStyle, toCategorySeverityBlock, toSeverityBlocks } from '../analyzers/severityBlocks.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { toCodeStyleBlocks } from '../codeStyle/codeStyleBlocks.ts';
import { resolveScope } from '../config/scopes.ts';
import { toGateContext } from '../config/versionGates.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import { CSHARP_GLOB, toCSharpFormattingEntries, toFormattingSections } from '../formatting/formattingSections.ts';
import { toNamingBlocks } from '../naming/namingBlocks.ts';
import type { EditorConfigBlock } from './editorConfigDocument.ts';
import { renderEditorConfig } from './editorConfigDocument.ts';
import type { GeneratedFile, GeneratedOutput, SkippedKey } from './generatedFile.ts';

const FILE_NAME = '.editorconfig';

/** Read back by the importer to list rules added since a config was made, and to restore the preset it started from. */
export const HEADER_PATTERN = /^# Settings for \.NET SDK (?<band>\S+), catalog (?<catalogVersion>\d{4}-\d{2}-\d{2})(?:, preset (?<preset>.+))?$/m;

/** How files are written; `presetName` records the preset the settings started from in the root file's header. */
export type EditorConfigOutputOptions = { commentStyle: CommentStyle; presetName?: string };

/**
 * One `.editorconfig` per scope: the root file holds `root = true`, and nested files hold only what their scope
 * overrides. Each scope's keys are checked against that scope's own target frameworks. Scopes with nothing to say get no file.
 */
/** With severities in a global AnalyzerConfig file, the root scope's severity blocks come back separately instead of in its `.editorconfig`. */
export type EditorConfigOutput = GeneratedOutput & { globalConfigBlocks: EditorConfigBlock[] };

export function toEditorConfigFiles(config: WizardConfig, catalog: Catalog, outputOptions: EditorConfigOutputOptions): EditorConfigOutput {
	const output: EditorConfigOutput = { files: [], skippedKeys: [], globalConfigBlocks: [] };
	for (const scope of config.scopes) {
		const scopeOutput = toEditorConfigFile(config, scope, catalog, outputOptions);
		if (scopeOutput.file) output.files.push(scopeOutput.file);
		output.skippedKeys.push(...scopeOutput.skippedKeys.map(skipped => ({ ...skipped, scopePath: scope.path })));
		output.globalConfigBlocks.push(...scopeOutput.globalConfigBlocks);
	}

	return output;
}

function toEditorConfigFile(
	config: WizardConfig,
	scope: ScopeConfig,
	catalog: Catalog,
	outputOptions: EditorConfigOutputOptions
): { file?: GeneratedFile; skippedKeys: SkippedKey[]; globalConfigBlocks: EditorConfigBlock[] } {
	const isRoot = scope.path === '';
	const context = toGateContext(resolveScope(config, scope), catalog);
	const codeStyle = toCodeStyleBlocks(scope.options ?? {}, catalog, context);
	const severities = toSeverityBlocks(scope.severities ?? {}, catalog, context, outputOptions.commentStyle);
	const severityBlocks = [toCategorySeverityBlock(scope.categorySeverities ?? {}), ...severities.blocks];
	const isGlobalConfig = isRoot && config.severityFile === 'globalconfig';
	const editorConfigSeverityBlocks = isGlobalConfig ? [] : severityBlocks;
	const globalConfigBlocks = isGlobalConfig ? severityBlocks.filter(block => block.entries.length > 0) : [];

	const sections = [
		...toFormattingSections(scope),
		{
			title: 'C# files',
			glob: CSHARP_GLOB,
			parts: [
				{ blocks: [{ entries: toCSharpFormattingEntries(scope) }, ...codeStyle.blocks, ...toNamingBlocks(scope.naming ?? [])] },
				{ title: 'Diagnostic severities', blocks: editorConfigSeverityBlocks }
			]
		}
	];

	const skippedKeys = [...codeStyle.skippedKeys, ...severities.skippedKeys];
	const hasEntries = sections.some(section => section.parts.some(part => part.blocks.some(block => block.entries.length > 0)));
	if (!isRoot && !hasEntries) return { skippedKeys, globalConfigBlocks };

	const file = {
		path: isRoot ? FILE_NAME : `${scope.path}/${FILE_NAME}`,
		content: renderEditorConfig({ headerComment: isRoot ? toHeaderComment(catalog, outputOptions.presetName) : undefined, isRoot, sections })
	};
	return { file, skippedKeys, globalConfigBlocks };
}

function toHeaderComment(catalog: Catalog, presetName: string | undefined): string {
	return `Settings for .NET SDK ${catalog.band.band}, catalog ${catalog.version}${presetName ? `, preset ${presetName}` : ''}`;
}
