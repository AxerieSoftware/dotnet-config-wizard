import { resolveInheritedScope } from './scopes.ts';
import type { ScopeConfig, WizardConfig } from './wizardConfig.ts';

/**
 * Common folders to add as scopes. None of them ship, so they aren't packed, and they turn off what only shipped
 * library code needs: ConfigureAwait (CA2007) and XML docs (CS1591).
 * - Tests also allow underscores in test names (CA1707) and public test classes (CA1515).
 * - Samples are apps that show the packages in use.
 * - Benchmarks keep BenchmarkDotNet's public, instance benchmark methods (CA1515, CA1822).
 */
export const SCOPE_PRESETS: readonly { title: string; description: string; scope: ScopeConfig }[] = [
	{ title: 'Source projects (src)', description: 'Library projects that ship.', scope: { path: 'src', projectKind: 'library' } },
	{
		title: 'Test projects (tests)',
		description: 'Not packed; allows underscores in test names and public test classes.',
		scope: { path: 'tests', projectKind: 'test', severities: { CA1707: 'none', CA2007: 'none', CA1515: 'none', CS1591: 'none' }, build: { IsPackable: 'false' } }
	},
	{
		title: 'Samples (samples)',
		description: 'Apps that show the packages in use; not packed.',
		scope: { path: 'samples', projectKind: 'service', severities: { CA2007: 'none', CS1591: 'none' }, build: { IsPackable: 'false' } }
	},
	{
		title: 'Benchmarks (benchmarks)',
		description: 'BenchmarkDotNet projects; not packed, with public instance benchmark methods allowed.',
		scope: { path: 'benchmarks', projectKind: 'service', severities: { CA2007: 'none', CA1515: 'none', CA1822: 'none', CS1591: 'none' }, build: { IsPackable: 'false' } }
	}
];

/**
 * A copy of a folder preset for this config, leaving out what the folder would inherit anyway. Folders that don't ship
 * don't inherit a library's AOT compatibility.
 */
export function toScopePreset(path: string, config: WizardConfig): ScopeConfig {
	const scope = structuredClone(SCOPE_PRESETS.find(preset => preset.scope.path === path)?.scope ?? { path });
	if (path !== 'src' && config.scopes[0].build?.IsAotCompatible === 'true') scope.build = { ...scope.build, IsAotCompatible: 'false' };

	const inherited = resolveInheritedScope(config, scope);
	if (!inherited) return scope;

	if (scope.severities) scope.severities = withoutInherited(scope.severities, inherited.severities);
	if (scope.build) scope.build = withoutInherited(scope.build, inherited.build);
	return scope;
}

function withoutInherited<TValue>(own: Record<string, TValue>, inherited: Record<string, TValue>): Record<string, TValue> {
	return Object.fromEntries(Object.entries(own).filter(([key, value]) => inherited[key] !== value));
}

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
