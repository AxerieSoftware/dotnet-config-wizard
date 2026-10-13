import type { ScopeConfig } from '../config/wizardConfig.ts';
import type { EditorConfigEntry, EditorConfigSection } from '../export/editorConfigDocument.ts';

export const CSHARP_GLOB = '[*.cs]';
export const ALL_FILES_GLOB = '[*]';

const SECTION_TITLES: Record<string, string> = {
	'[*]': 'All files',
	'[*.md]': 'Markdown',
	'[*.json]': 'JSON',
	'[*.{yml,yaml}]': 'YAML',
	'[*.{csproj,props,targets,xml,sln,slnx,config,nuspec,resx}]': 'MSBuild, XML and solutions',
	'[*.sh]': 'Shell scripts',
	'[*.{cmd,bat}]': 'Windows scripts',
	'[*.ps1]': 'PowerShell scripts'
};

/** Builds a section for every formatting glob except C#, whose entries lead the C# section instead. */
export function toFormattingSections(scope: ScopeConfig): EditorConfigSection[] {
	return Object.entries(scope.formatting ?? {})
		.filter(([glob]) => glob !== CSHARP_GLOB)
		.map(([glob, settings]) => ({ title: SECTION_TITLES[glob] ?? glob, glob, parts: [{ blocks: [{ entries: toEntries(settings) }] }] }));
}

export function toCSharpFormattingEntries(scope: ScopeConfig): EditorConfigEntry[] {
	// Roslyn treats generated code as off limits, so analyzers skip an ignored folder and its nullable warnings turn off.
	const ignored = scope.isIgnored ? [{ key: 'generated_code', value: 'true' }] : [];
	return [...ignored, ...toEntries(scope.formatting?.[CSHARP_GLOB] ?? {})];
}

function toEntries(settings: Record<string, string>): EditorConfigEntry[] {
	return Object.entries(settings).map(([key, value]) => ({ key, value }));
}
