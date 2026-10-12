import type { ScopeConfig } from './wizardConfig.ts';

/**
 * Common folders to add as scopes. Test projects get relaxed rules that don't suit test code: underscores in test names
 * (CA1707), ConfigureAwait (CA2007), making public test classes internal (CA1515) and XML docs (CS1591), and they aren't packed.
 */
export const SCOPE_PRESETS: readonly { title: string; scope: ScopeConfig }[] = [
	{ title: 'Source projects (src)', scope: { path: 'src', projectKind: 'library' } },
	{
		title: 'Test projects (tests)',
		scope: { path: 'tests', projectKind: 'test', severities: { CA1707: 'none', CA2007: 'none', CA1515: 'none', CS1591: 'none' }, build: { IsPackable: 'false' } }
	}
];

export type ScopePathResult = { status: 'valid'; path: string } | { status: 'invalid'; reason: string };

/** Normalizes a typed folder such as `/tests/Unit/` into a scope path such as `tests/Unit`, rejecting paths that leave the repo. */
export function toScopePath(text: string, existingPaths: readonly string[]): ScopePathResult {
	const path = text
		.trim()
		.replaceAll('\\', '/')
		.replaceAll(/\/+/g, '/')
		.replace(/^\.?\//, '')
		.replace(/\/$/, '');
	if (path === '') return { status: 'invalid', reason: 'Enter a folder, such as tests or src/Legacy.' };
	if (path.split('/').some(segment => segment === '..' || segment === '.')) return { status: 'invalid', reason: 'The folder must be inside the repo.' };
	if (existingPaths.includes(path)) return { status: 'invalid', reason: `${path} already has settings.` };
	return { status: 'valid', path };
}
