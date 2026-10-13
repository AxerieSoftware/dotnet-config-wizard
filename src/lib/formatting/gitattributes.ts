import type { ScopeConfig } from '../config/wizardConfig.ts';
import { ALL_FILES_GLOB } from './formattingSections.ts';

/**
 * Renders a `.gitattributes` that matches the root scope's line endings, or undefined when `[*]` sets none. Without it,
 * Git's autocrlf can check files out with CRLF on Windows and IDE0055 then fails on every line.
 */
export function toGitAttributes(rootScope: ScopeConfig): string | undefined {
	const formatting = rootScope.formatting ?? {};
	const defaultEndOfLine = formatting[ALL_FILES_GLOB]?.end_of_line;
	if (!defaultEndOfLine) return undefined;

	const lines = [`* text=auto eol=${defaultEndOfLine}`];
	for (const [glob, settings] of Object.entries(formatting)) {
		if (glob === ALL_FILES_GLOB || !settings.end_of_line || settings.end_of_line === defaultEndOfLine) continue;

		lines.push(...toGitPatterns(glob).map(pattern => `${pattern} text eol=${settings.end_of_line}`));
	}

	return `${lines.join('\n')}\n`;
}

/** Turns an EditorConfig section such as `[*.{cmd,bat}]` into Git patterns such as `*.cmd` and `*.bat`. */
function toGitPatterns(glob: string): string[] {
	const pattern = glob.slice(1, -1);
	const braces = /\{([^}]+)\}/.exec(pattern);
	if (!braces) return [pattern];

	return braces[1].split(',').map(choice => pattern.replace(braces[0], choice));
}
