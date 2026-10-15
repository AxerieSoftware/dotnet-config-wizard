import { ALL_FILES_GLOB, CSHARP_GLOB } from './formattingSections.ts';

export type FormattingKey = { key: string; label: string; values: string[] };

export const FORMATTING_KEYS: readonly FormattingKey[] = [
	{ key: 'charset', label: 'Character set', values: ['utf-8', 'utf-8-bom', 'latin1', 'utf-16be', 'utf-16le'] },
	{ key: 'end_of_line', label: 'Line endings', values: ['lf', 'crlf', 'cr'] },
	{ key: 'indent_style', label: 'Indent style', values: ['space', 'tab'] },
	{ key: 'indent_size', label: 'Indent size', values: ['2', '4', '8', 'tab'] },
	{ key: 'tab_width', label: 'Tab width', values: ['2', '4', '8'] },
	{ key: 'insert_final_newline', label: 'Final newline', values: ['true', 'false'] },
	{ key: 'trim_trailing_whitespace', label: 'Trim trailing whitespace', values: ['true', 'false'] },
	{ key: 'max_line_length', label: 'Max line length', values: ['80', '100', '120', '150', '200', 'off'] }
];

export const FORMATTING_GLOBS: readonly { glob: string; title: string }[] = [
	{ glob: ALL_FILES_GLOB, title: 'All files' },
	{ glob: CSHARP_GLOB, title: 'C# files' },
	{ glob: '[*.{csproj,props,targets,xml,sln,slnx,config,nuspec,resx}]', title: 'MSBuild, XML and solutions' },
	{ glob: '[*.json]', title: 'JSON' },
	{ glob: '[*.{yml,yaml}]', title: 'YAML' },
	{ glob: '[*.md]', title: 'Markdown' },
	{ glob: '[*.sh]', title: 'Shell scripts' },
	{ glob: '[*.{cmd,bat}]', title: 'Windows scripts' },
	{ glob: '[*.ps1]', title: 'PowerShell scripts' }
];
