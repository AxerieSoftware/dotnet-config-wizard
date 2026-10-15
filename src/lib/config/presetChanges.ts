import type { Catalog } from '../catalog/catalog.ts';
import { isObject } from './mergePatch.ts';
import { toPresetConfig } from './presets.ts';
import { type SavedState, toKeyed } from './shareLink.ts';
import type { WizardConfig } from './wizardConfig.ts';

/** One setting that differs from the preset: where it is, what it is, and both values. */
export type PresetChange = { folderPath: string | undefined; setting: string; presetValue: string; value: string };

const GROUP_LABELS: Readonly<Record<string, string>> = {
	severities: 'Rule',
	categorySeverities: 'Category',
	options: 'Code style',
	build: 'Build',
	ciBuild: 'CI build',
	formatting: 'Formatting',
	ruleParameters: 'Rule parameter',
	globalJson: 'global.json',
	nuget: 'nuget.config',
	versions: 'SDK'
};

// Folder settings that are a single value or a list, rather than a group of keyed settings.
const SETTING_LABELS: Readonly<Record<string, string>> = {
	projectKind: 'Project kind',
	tfms: 'Target frameworks',
	packages: 'Analyzer packages',
	naming: 'Naming rules',
	bannedApis: 'Banned APIs',
	isIgnored: 'Ignored',
	isTargetFrameworkShared: 'Shared TargetFramework',
	areInternalsVisibleToTests: 'Internals visible to tests',
	projectNamePrefix: 'Project name prefix',
	severityFile: 'Severities file'
};

const NOT_SET = 'not set';

/** Every setting that differs from the preset the config started from, read from the diff share links store. */
export function toPresetChanges(state: SavedState, config: WizardConfig, catalog: Catalog): PresetChange[] {
	const presetConfig = toKeyed(toPresetConfig(state.preset, catalog));
	const changes = state.changes as Record<string, unknown>;
	const keyed = toKeyed(config);

	return Object.entries(changes).flatMap(([key, change]) => {
		if (key !== 'scopes') return toChanges(undefined, [key], change, presetConfig[key as keyof typeof presetConfig], keyed[key as keyof typeof keyed]);

		return Object.entries(change as Record<string, unknown>).flatMap(([folderPath, scopeChange]) => {
			const presetScope = presetConfig.scopes[folderPath];
			if (scopeChange === null) return [{ folderPath, setting: 'Folder', presetValue: 'in the preset', value: 'removed' }];
			if (!presetScope) return [{ folderPath, setting: 'Folder', presetValue: 'not in the preset', value: 'added' }];

			return toChanges(folderPath, [], scopeChange, presetScope, keyed.scopes[folderPath]);
		});
	});
}

/** Walks a merge patch down to the settings it changes; lists, such as packages, count as one setting. */
function toChanges(folderPath: string | undefined, path: string[], change: unknown, presetValue: unknown, value: unknown): PresetChange[] {
	if (isObject(change) && isObject(presetValue)) {
		return Object.entries(change).flatMap(([key, nested]) => toChanges(folderPath, [...path, key], nested, presetValue[key], isObject(value) ? value[key] : undefined));
	}

	return [{ folderPath, setting: toSettingLabel(path), presetValue: toDisplayValue(presetValue), value: toDisplayValue(change === null ? undefined : value) }];
}

function toSettingLabel(path: readonly string[]): string {
	const [group, ...rest] = path;
	const label = GROUP_LABELS[group];
	if (label && rest.length > 0) return `${label}: ${rest.join(' ')}`;
	return SETTING_LABELS[group] ?? path.join(' ');
}

function toDisplayValue(value: unknown): string {
	if (value === undefined || value === null) return NOT_SET;
	if (Array.isArray(value)) return value.length === 0 ? 'none' : value.map(toEntryName).join(', ');
	if (isObject(value)) return `${Object.keys(value).length} settings`;
	return String(value);
}

/** A list entry's name: a package or framework, a naming rule's symbol group, or a banned API's symbol. */
function toEntryName(entry: unknown): string {
	if (!isObject(entry)) return String(entry);
	return String(entry.symbols ?? entry.symbol ?? '…');
}
