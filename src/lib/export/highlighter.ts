import type { HighlighterCore, ThemedToken } from 'shiki/core';

export type CodeLanguage = 'ini' | 'xml' | 'json' | 'csharp';

/** The token colors for light and dark, as `--shiki-light` and `--shiki-dark` custom properties. */
export type CodeToken = { content: string; style: string };

let highlighter: Promise<HighlighterCore> | undefined;
let csharpHighlighter: Promise<HighlighterCore> | undefined;

/** The grammar for a generated file, or undefined for plain text such as `.gitattributes`. */
export function toCodeLanguage(path: string): CodeLanguage | undefined {
	if (path.endsWith('.editorconfig') || path.endsWith('.globalconfig')) return 'ini';
	if (path.endsWith('.props') || path.endsWith('.xml') || path.endsWith('.config')) return 'xml';
	if (path.endsWith('.json')) return 'json';
	return undefined;
}

/** Loads Shiki once, with only the grammars and VS Code's default themes the generated files need. */
export function loadHighlighter(): Promise<HighlighterCore> {
	highlighter ??= Promise.all([import('shiki/core'), import('shiki/engine/javascript')]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
		createHighlighterCore({
			themes: [import('shiki/themes/light-plus.mjs'), import('shiki/themes/dark-plus.mjs')],
			langs: [import('shiki/langs/ini.mjs'), import('shiki/langs/xml.mjs'), import('shiki/langs/json.mjs')],
			engine: createJavaScriptRegexEngine()
		})
	);
	return highlighter;
}

/** Loads Shiki with C# ready, fetching its large grammar once, when an example first needs it. */
export function loadCSharpHighlighter(): Promise<HighlighterCore> {
	csharpHighlighter ??= loadHighlighter()
		.then(async loaded => {
			await loaded.loadLanguage(import('shiki/langs/csharp.mjs'));
			return loaded;
		})
		.catch((error: unknown) => {
			// A failed load, such as a dropped connection, is tried again by the next example.
			csharpHighlighter = undefined;
			throw error;
		});
	return csharpHighlighter;
}

/**
 * Splits code into colored tokens, one array per line. A line whose tokens don't spell it out exactly, such as an empty
 * line Shiki renders as a space, gets none, so it shows as plain text and copies unchanged.
 */
export function toCodeTokens(loaded: HighlighterCore, code: string, language: CodeLanguage): (CodeToken[] | undefined)[] {
	const { tokens } = loaded.codeToTokens(code, { lang: language, themes: { light: 'light-plus', dark: 'dark-plus' }, defaultColor: false });
	const lines = code.split('\n');
	return tokens.map((line, index) => (line.map(token => token.content).join('') === lines[index] ? line.map(toCodeToken) : undefined));
}

function toCodeToken(token: ThemedToken): CodeToken {
	const style = Object.entries(token.htmlStyle ?? {})
		.map(([name, value]) => `${name}:${value}`)
		.join(';');
	return { content: token.content, style };
}
