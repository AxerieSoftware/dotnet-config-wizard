import { GLOBAL_CONFIG_FILE } from '../analyzers/globalConfig.ts';
import type { CommentStyle } from '../analyzers/severityBlocks.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { resolveScope } from '../config/scopes.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import type { GeneratedFile } from './generatedFile.ts';
import { toGeneratedOutput } from './generatedOutput.ts';

const EFFECTIVE_FILE_PATHS = ['.editorconfig', 'Directory.Build.props', 'Directory.Packages.props', GLOBAL_CONFIG_FILE];
// An .editorconfig key, or an MSBuild property or item: the lines a folder can set or override.
const SETTING_LINE = /^(?:[\w.-]+\s*=|<\w+>[^<]*<\/\w+>|<\w+ (?:Include|Remove)=)/;

/** Whether a file builds on the same file in the folders above, so it has an effective version. */
export function hasEffectiveVersion(fileName: string): boolean {
	return EFFECTIVE_FILE_PATHS.includes(fileName);
}

/** A merged file, with the setting lines the folder itself writes rather than inherits. */
export type EffectiveFile = GeneratedFile & { ownLines: ReadonlySet<string> };

/**
 * What a project in a folder actually gets: every setting it inherits with the folder's own on top, written as one set of
 * root files. Lines the folder's own files also write are marked, so overrides stand out from inherited settings.
 */
export function toEffectiveFiles(config: WizardConfig, scope: ScopeConfig, catalog: Catalog, commentStyle: CommentStyle, folderFiles: readonly GeneratedFile[]): EffectiveFile[] {
	const { projectKind, ...resolved } = resolveScope(config, scope);
	const merged: ScopeConfig = { ...resolved, path: '', ...(projectKind ? { projectKind } : {}) };

	return toGeneratedOutput({ ...config, scopes: [merged] }, catalog, { commentStyle })
		.files.filter(file => EFFECTIVE_FILE_PATHS.includes(file.path))
		.map(file => {
			const ownFile = folderFiles.find(folderFile => folderFile.path === `${scope.path}/${file.path}`);
			return { ...file, ownLines: new Set(toSettingLines(ownFile?.content ?? '')) };
		});
}

function toSettingLines(content: string): string[] {
	return content
		.split('\n')
		.map(line => line.trim())
		.filter(line => SETTING_LINE.test(line));
}
