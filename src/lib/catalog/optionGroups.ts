/**
 * Friendly titles and display order for the dotnet/docs option groups. Every group CatalogBuilder emits must be listed;
 * a unit test enforces it so a new docs group can't silently land in the wrong place.
 */
export const OPTION_GROUPS: readonly { docsGroups: string[]; title: string }[] = [
	{ docsGroups: ['Using directive options'], title: 'Organize usings' },
	{ docsGroups: ["Language rules ('this.' and 'Me.' qualifiers)"], title: 'this. and Me. qualification' },
	{ docsGroups: ['Language rules (language keywords instead of framework type names)'], title: 'Language keywords instead of framework type names' },
	{ docsGroups: ['Language rules (modifier preferences)'], title: 'Modifiers' },
	{ docsGroups: ['Language rules (parentheses preferences)'], title: 'Parentheses' },
	{ docsGroups: ['Language rules (expression-level preferences)'], title: 'Expression-level preferences' },
	{ docsGroups: ['Language rules (null-checking preferences)'], title: 'Null checking' },
	{ docsGroups: ['Language rules (field preferences)'], title: 'Fields' },
	{ docsGroups: ["Language rules ('var' preferences)"], title: 'var preferences' },
	{ docsGroups: ['Language rules (expression-bodied members)'], title: 'Expression-bodied members' },
	{ docsGroups: ['Language rules (pattern matching preferences)'], title: 'Pattern matching' },
	{ docsGroups: ['Language rules (code-block preferences)', 'Language rules (code block preferences)'], title: 'Code blocks' },
	{ docsGroups: ['Language rules (`using` directive preferences)'], title: 'using placement and file header' },
	{ docsGroups: ['Unnecessary code rules (expression-level preferences)'], title: 'Unused values' },
	{ docsGroups: ['Unnecessary code rules (parameter preferences)'], title: 'Unused parameters' },
	{ docsGroups: ['Unnecessary code rules (suppression preferences)'], title: 'Unnecessary suppressions' },
	{ docsGroups: ['Language rules (new-line preferences)'], title: 'Blank lines (experimental)' },
	{ docsGroups: ['New-line options'], title: 'New lines' },
	{ docsGroups: ['Indentation options'], title: 'Indentation' },
	{ docsGroups: ['Spacing options'], title: 'Spacing' },
	{ docsGroups: ['Wrap options'], title: 'Wrapping' }
];
