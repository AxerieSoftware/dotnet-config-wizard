import type { IconName } from './Icon.svelte';

export const STEP_PATHS = {
	start: '/wizard/start',
	formatting: '/wizard/formatting',
	codeStyle: '/wizard/code-style',
	naming: '/wizard/naming',
	analyzers: '/wizard/analyzers',
	build: '/wizard/build',
	packages: '/wizard/packages',
	sdk: '/wizard/sdk',
	review: '/wizard/review'
} as const;

/**
 * Wizard steps in order. Wide steps hide the preview pane: the review step shows the files itself. Repo-wide steps set
 * nothing per folder, so they don't say which folder is being edited.
 */
export const WIZARD_STEPS: readonly { path: string; title: string; icon: IconName; isWide?: boolean; isRepoWide?: boolean }[] = [
	{ path: STEP_PATHS.start, title: 'Start', icon: 'rocket', isRepoWide: true },
	{ path: STEP_PATHS.formatting, title: 'Formatting', icon: 'textIndentIncrease' },
	{ path: STEP_PATHS.codeStyle, title: 'Code style', icon: 'code' },
	{ path: STEP_PATHS.naming, title: 'Naming', icon: 'textCaseTitle' },
	{ path: STEP_PATHS.analyzers, title: 'Analyzers', icon: 'shieldCheckmark' },
	{ path: STEP_PATHS.build, title: 'Build', icon: 'wrench' },
	{ path: STEP_PATHS.packages, title: 'Packages', icon: 'box' },
	{ path: STEP_PATHS.sdk, title: 'SDK', icon: 'toolbox', isRepoWide: true },
	{ path: STEP_PATHS.review, title: 'Review and export', icon: 'documentCheckmark', isWide: true, isRepoWide: true }
];
