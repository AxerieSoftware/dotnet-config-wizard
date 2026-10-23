import type { Catalog } from '../catalog/catalog.ts';
import { isEmpty, type Preset, toFolderSettings, withoutInherited } from './presets.ts';
import { resolveInheritedScope } from './scopes.ts';
import type { ProjectKind, ScopeConfig, Severity, WizardConfig } from './wizardConfig.ts';

/**
 * Common folders to add, each holding one kind of project with that kind's defaults. Samples and benchmarks are apps that
 * don't ship, so they aren't packed and turn off what only shipped library code needs: ConfigureAwait (CA2007) and XML
 * docs (CS1591). Benchmarks also keep BenchmarkDotNet's public, instance benchmark methods (CA1515, CA1822).
 */
export const SCOPE_PRESETS: readonly { path: string; projectKind: ProjectKind; description: string; severities?: Record<string, Severity>; build?: Record<string, string> }[] = [
	{ path: 'src', projectKind: 'library', description: 'Library projects that ship.' },
	{ path: 'tests', projectKind: 'test', description: 'Not packed; allows underscores in test names and public test classes.' },
	{ path: 'samples', projectKind: 'service', description: 'Apps that show the packages in use; not packed.', severities: { CA2007: 'none', CS1591: 'none' }, build: { IsPackable: 'false' } },
	{
		path: 'benchmarks',
		projectKind: 'service',
		description: 'BenchmarkDotNet projects; not packed, with public instance benchmark methods allowed.',
		severities: { CA2007: 'none', CA1515: 'none', CA1822: 'none', CS1591: 'none' },
		build: { IsPackable: 'false' }
	}
];

/** A common folder for this config: its kind's defaults at the preset's level, plus what the folder itself changes. */
export function toScopePreset(path: string, config: WizardConfig, preset: Preset, catalog: Catalog): ScopeConfig {
	return toKindSettings(path, SCOPE_PRESETS.find(entry => entry.path === path)?.projectKind, config, preset, catalog);
}

/** What a folder holding `projectKind` starts with, including a common folder's own changes while it holds its usual kind. */
export function toKindSettings(path: string, projectKind: ProjectKind | undefined, config: WizardConfig, preset: Preset, catalog: Catalog): ScopeConfig {
	const folderPreset = SCOPE_PRESETS.find(entry => entry.path === path && entry.projectKind === projectKind);
	const scope = toFolderSettings(path, projectKind, preset, config, catalog);
	if (!folderPreset) return scope;

	const inherited = resolveInheritedScope(config, scope);
	const severities = { ...scope.severities, ...withoutInherited(folderPreset.severities ?? {}, inherited?.severities ?? {}) };
	const build = { ...scope.build, ...withoutInherited(folderPreset.build ?? {}, inherited?.build ?? {}) };
	return { ...scope, ...(isEmpty(severities) ? {} : { severities }), ...(isEmpty(build) ? {} : { build }) };
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
