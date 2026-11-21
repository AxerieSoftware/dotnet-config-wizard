import type { Catalog } from '../catalog/catalog.ts';
import { applyMergePatch, isObject } from './mergePatch.ts';
import { PRESET_LEVELS, type Preset, toPresetConfigWithSource } from './presets.ts';
import { toKindSettings } from './scopePresets.ts';
import { fromKeyed, type KeyedConfig, toKeyed } from './shareLink.ts';
import { type CommentStyles, findCommentStylesProblem, PROJECT_KINDS, type ProjectKind, parseWizardConfig, type WizardConfig } from './wizardConfig.ts';

/**
 * A repo's config kept as a preset, what each folder holds, and a merge patch of only what the repo changes. Each render
 * starts from the preset as the wizard defines it then, so a template's repos pick up new defaults with the wizard version
 * they pin instead of keeping copies of them.
 */
export type RepoConfig = { preset: Preset; sdkBand: string; folders: Record<string, ProjectKind>; changes?: unknown; comments?: CommentStyles };

export type RepoConfigResult = { status: 'valid'; config: WizardConfig } | { status: 'invalid'; reason: string };

/** Whether a config file is a repo config rather than a full wizard config, which has `versions` and `scopes` instead. */
export function isRepoConfig(value: unknown): value is Record<string, unknown> {
	return isObject(value) && 'preset' in value;
}

export function findRepoConfigProblem(value: Record<string, unknown>): string | undefined {
	if (!PRESET_LEVELS.includes(value.preset as Preset)) return `preset must be one of ${PRESET_LEVELS.join(', ')}.`;
	if (typeof value.sdkBand !== 'string') return 'sdkBand must be a string, such as 11.0.1xx.';
	if (!isObject(value.folders) || Object.values(value.folders).some(kind => !PROJECT_KINDS.includes(kind as ProjectKind))) return `folders must map folder paths to ${PROJECT_KINDS.join(', ')}.`;
	if (Object.keys(value.folders).includes('')) return 'folders lists folders below the repo root; the root holds what they share.';
	if (value.changes !== undefined && !isObject(value.changes)) return 'changes must be a JSON merge patch object.';
	return findCommentStylesProblem(value.comments);
}

/** The full config a repo config stands for: the preset, each folder with its kind's defaults, then the repo's changes. */
export function toRepoWizardConfig(repoConfig: RepoConfig, catalog: Catalog): RepoConfigResult {
	const config = toPresetConfigWithSource(repoConfig.preset, undefined, catalog);
	config.scopes = [config.scopes[0]];
	if (repoConfig.comments) config.comments = repoConfig.comments;
	for (const [path, kind] of Object.entries(repoConfig.folders)) config.scopes.push(toKindSettings(path, kind, config, repoConfig.preset, catalog));

	const changed = fromKeyed(applyMergePatch(toKeyed(config), repoConfig.changes ?? {}) as KeyedConfig);
	const parseResult = parseWizardConfig(changed);
	return parseResult.status === 'invalid' ? { status: 'invalid', reason: `The changes don't make a valid config: ${parseResult.reason}` } : { status: 'valid', config: parseResult.config };
}
