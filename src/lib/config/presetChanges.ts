import type { Catalog } from '../catalog/catalog.ts';
import { isObject } from './mergePatch.ts';
import { toPresetConfig } from './presets.ts';
import { type SavedState, toKeyed } from './shareLink.ts';
import { PROJECT_KIND_TITLES, PROJECT_KINDS, type ProjectKind, type WizardConfig } from './wizardConfig.ts';

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

// Settings that are a single value or a list, rather than a group of keyed settings.
const SETTING_LABELS: Readonly<Record<string, string>> = {
	projectKind: 'Project kind',
	tfms: 'Target frameworks',
	packages: 'Analyzer packages',
	naming: 'Naming rules',
	bannedApis: 'Banned APIs',
	isIgnored: 'Ignored',
	isTargetFrameworkShared: 'Shared TargetFramework',
	areInternalsVisibleToTests: 'Internals visible to tests',
	isProjectUnderTestReferenced: 'Project under test referenced',
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

	// What a folder holds reads the way the Folders card names it, such as Apps and services.
	const toDisplay = path[0] === 'projectKind' ? toKindTitle : toDisplayValue;
	return [{ folderPath, setting: toSettingLabel(path), presetValue: toDisplay(presetValue), value: toDisplay(change === null ? undefined : value) }];
}

function toKindTitle(value: unknown): string {
	return PROJECT_KINDS.includes(value as ProjectKind) ? PROJECT_KIND_TITLES[value as ProjectKind] : NOT_SET;
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

/** A list entry's name: a package or framework, a naming rule's symbol group, a banned API's symbol, or a NuGet source's key. */
function toEntryName(entry: unknown): string {
	if (!isObject(entry)) return String(entry);
	return String(entry.symbols ?? entry.symbol ?? entry.key ?? '…');
}
