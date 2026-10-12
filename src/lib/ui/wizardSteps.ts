export const REVIEW_STEP_PATH = '/wizard/review';

export const WIZARD_STEPS: readonly { path: string; title: string }[] = [
	{ path: '/wizard/formatting', title: 'Formatting' },
	{ path: '/wizard/code-style', title: 'Code style' },
	{ path: REVIEW_STEP_PATH, title: 'Review and export' }
];
