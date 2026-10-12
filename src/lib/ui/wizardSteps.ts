export const REVIEW_STEP_PATH = '/wizard/review';

export const WIZARD_STEPS: readonly { path: string; title: string }[] = [
	{ path: '/wizard/start', title: 'Start' },
	{ path: '/wizard/formatting', title: 'Formatting' },
	{ path: '/wizard/code-style', title: 'Code style' },
	{ path: '/wizard/naming', title: 'Naming' },
	{ path: REVIEW_STEP_PATH, title: 'Review and export' }
];
