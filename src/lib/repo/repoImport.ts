import { GLOBAL_CONFIG_FILE } from '../analyzers/globalConfig.ts';
import type { Catalog } from '../catalog/catalog.ts';
import type { BandEntry } from '../catalog/catalogFiles.ts';
import { ALL_PRESETS, type Preset, toPresetConfig, toPresetName } from '../config/presets.ts';
import { resolveInheritedScope } from '../config/scopes.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import { HEADER_PATTERN } from '../export/editorConfigFiles.ts';
import { toFileName, toFolderPath } from '../export/fileTree.ts';
import { importFile } from '../import/importFile.ts';
import type { ImportNote } from '../import/importResult.ts';
import { mergeImport } from '../import/mergeImport.ts';
import { importBannedSymbols, importGlobalJson, importNuGetConfig, importSonarLintXml } from '../import/repoSettingsImport.ts';
import { findUnmanaged } from './preserve.ts';
import { isConfigFile, type RepoFile } from './repoFiles.ts';

/** A repo's settings, the notes about loading them, and the preset its root `.editorconfig` says they started from. */
export type RepoImport = { config: WizardConfig; notes: (ImportNote & { fileName: string })[]; preset?: Preset };

/** The SDK band a repo's `global.json` pins, such as `10.0.4xx` for `10.0.401`, when the catalog covers it. */
export function findPinnedBand(files: readonly RepoFile[], bands: readonly BandEntry[]): BandEntry | undefined {
	const globalJson = files.find(file => file.path === 'global.json');
	const sdkVersion = globalJson ? importGlobalJson(globalJson.text)?.sdkVersion : undefined;
	const band = sdkVersion?.replace(/^(\d+\.\d+\.\d)\d\d.*$/, '$1xx');
	return bands.find(entry => entry.band === band);
}

/**
 * Builds a config from a repo's config files. Each folder that holds one becomes a folder in the wizard, filled from the
 * root down, so the order the files arrive in doesn't matter. Settings the wizard doesn't manage are listed in the notes;
 * they stay in the files when the wizard saves.
 */
export function toRepoConfig(repoFiles: readonly RepoFile[], catalog: Catalog): RepoImport {
	const files = repoFiles.filter(file => isConfigFile(file.path));
	const folderPaths = [...new Set(['', ...files.map(file => toFolderPath(file.path))])].sort((left, right) => toDepth(left) - toDepth(right) || left.localeCompare(right));
	const scopes: ScopeConfig[] = folderPaths.map(path => ({ path }));
	const config: WizardConfig = { versions: { sdkBand: catalog.band.band }, scopes };
	const notes: RepoImport['notes'] = [];

	const sortedFiles = [...files].sort((left, right) => toDepth(left.path) - toDepth(right.path) || left.path.localeCompare(right.path));
	for (const file of sortedFiles) {
		const scope = scopes.find(entry => entry.path === toFolderPath(file.path)) ?? scopes[0];
		notes.push(...importRepoFile(file, scope, config, catalog).map(note => ({ ...note, fileName: file.path })));

		const unmanaged = findUnmanaged(file.path, file.text, catalog);
		if (unmanaged.length > 0) notes.push({ fileName: file.path, severity: 'info', message: `Kept as is: ${[...new Set(unmanaged)].join(', ')}.` });
	}

	addInheritedAndFrameworkPackages(config, catalog);
	const preset = findHeaderPreset(files);
	if (preset) addPresetFolders(config, preset, catalog);

	// Every folder needs target frameworks to gate options by C# version; the root falls back to the band's own.
	scopes[0].tfms ??= [`net${catalog.band.channel}`];
	return { config, notes, preset };
}

/** The preset named in the root `.editorconfig` header, which the wizard writes so a reopened repo keeps its preset. */
function findHeaderPreset(files: readonly RepoFile[]): Preset | undefined {
	const presetName = HEADER_PATTERN.exec(files.find(file => file.path === '.editorconfig')?.text ?? '')?.groups?.preset;
	return ALL_PRESETS.find(preset => toPresetName(preset) === presetName);
}

/**
 * Project kinds and folders without settings leave nothing on disk, so they come back from the preset: a folder keeps its
 * preset kind, and a preset folder the repo has no files for is added.
 */
function addPresetFolders(config: WizardConfig, preset: Preset, catalog: Catalog): void {
	for (const presetScope of toPresetConfig(preset, catalog).scopes) {
		const scope = config.scopes.find(entry => entry.path === presetScope.path);
		if (!scope) config.scopes.push({ path: presetScope.path, projectKind: presetScope.projectKind });
		else if (presetScope.projectKind) scope.projectKind ??= presetScope.projectKind;
	}
}

function importRepoFile(file: RepoFile, scope: ScopeConfig, config: WizardConfig, catalog: Catalog): ImportNote[] {
	const fileName = toFileName(file.path);
	if (fileName === 'global.json') {
		const imported = importGlobalJson(file.text);
		if (imported) config.globalJson = imported.globalJson;
		return [];
	}

	if (fileName.toLowerCase() === 'nuget.config') {
		const nuget = importNuGetConfig(file.text);
		if (nuget) config.nuget = nuget;
		return [];
	}

	if (fileName === 'BannedSymbols.txt') {
		scope.bannedApis = importBannedSymbols(file.text);
		return [];
	}

	if (fileName === 'SonarLint.xml') {
		config.scopes[0].ruleParameters = importSonarLintXml(file.text);
		return [];
	}

	if (fileName === GLOBAL_CONFIG_FILE) config.severityFile = 'globalconfig';
	const result = importFile(fileName, file.text, catalog);
	if (!result) return [];

	mergeImport(config, scope, result);
	// What the importers report as dropped stays in the file, so only the other notes apply here.
	return result.notes.filter(note => !note.isDropped);
}

/**
 * A nested props file lists only the packages it adds, and framework analyzers such as MSTest's are never referenced, so
 * each folder gets its parent's packages, its own, and any framework whose rules it configures.
 */
function addInheritedAndFrameworkPackages(config: WizardConfig, catalog: Catalog): void {
	for (const scope of config.scopes) {
		const inherited = resolveInheritedScope(config, scope)?.packages ?? [];
		const known = new Set([...inherited, ...(scope.packages ?? [])]);
		const frameworks = Object.keys(scope.severities ?? {})
			.map(id => catalog.rules.get(id)?.packageId)
			.filter((packageId): packageId is string => typeof packageId === 'string' && Boolean(catalog.packages.get(packageId)?.includedWith) && !known.has(packageId));
		if (!scope.packages && frameworks.length === 0) continue;

		scope.packages = [...new Set([...known, ...frameworks])];
	}
}

function toDepth(path: string): number {
	return path === '' ? 0 : path.split('/').length;
}
