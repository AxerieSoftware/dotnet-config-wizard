/** Wizard steps in order. Wide steps hide the preview pane: the review step shows the files itself, and the rule browser needs the room. */
export const WIZARD_STEPS: readonly { path: string; title: string; isWide?: boolean }[] = [
	{ path: '/wizard/start', title: 'Start' },
	{ path: '/wizard/formatting', title: 'Formatting' },
	{ path: '/wizard/code-style', title: 'Code style' },
	{ path: '/wizard/naming', title: 'Naming' },
	{ path: '/wizard/analyzers', title: 'Analyzers', isWide: true },
	{ path: '/wizard/review', title: 'Review and export', isWide: true }
];
