import type { ScopeConfig } from '../config/wizardConfig.ts';
import type { EditorConfigEntry, EditorConfigSection } from '../export/editorConfigDocument.ts';

export const CSHARP_GLOB = '[*.cs]';

const SECTION_TITLES: Record<string, string> = {
	'[*]': 'All files',
	'[*.md]': 'Markdown',
	'[*.json]': 'JSON',
	'[*.{yml,yaml}]': 'YAML',
	'[*.{csproj,props,targets,xml,slnx,config,nuspec,resx}]': 'MSBuild and XML',
	'[*.sln]': 'Solution files',
	'[*.sh]': 'Shell scripts',
	'[*.{cmd,bat}]': 'Windows scripts',
	'[*.ps1]': 'PowerShell scripts',
	'[*.vb]': 'Visual Basic files'
};

/** Builds a section for every formatting glob except C#, whose entries lead the C# section instead. */
export function toFormattingSections(scope: ScopeConfig): EditorConfigSection[] {
	return Object.entries(scope.formatting ?? {})
		.filter(([glob]) => glob !== CSHARP_GLOB)
		.map(([glob, settings]) => ({ title: SECTION_TITLES[glob] ?? glob, glob, parts: [{ blocks: [{ entries: toEntries(settings) }] }] }));
}

export function toCSharpFormattingEntries(scope: ScopeConfig): EditorConfigEntry[] {
	return toEntries(scope.formatting?.[CSHARP_GLOB] ?? {});
}

function toEntries(settings: Record<string, string>): EditorConfigEntry[] {
	return Object.entries(settings).map(([key, value]) => ({ key, value }));
}
