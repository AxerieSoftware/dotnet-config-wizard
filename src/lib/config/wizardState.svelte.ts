import { createContext } from 'svelte';
import { type AnalysisMode, toAnalysisLevelValue } from '../analyzers/analysisLevel.ts';
import type { BannedApi } from '../analyzers/bannedApis.ts';
import { COMMENT_STYLES, type CommentStyle } from '../analyzers/severityBlocks.ts';
import { isFrameworkProperty } from '../build/buildPropsFiles.ts';
import { toList } from '../build/msbuildValues.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { BANDS, DEFAULT_BAND, loadCatalog } from '../catalog/loadCatalog.ts';
import { toEffectiveFiles } from '../export/effectiveFiles.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import type { SettingLine } from '../export/lineInfo.ts';
import { importFile } from '../import/importFile.ts';
import type { ImportNote } from '../import/importResult.ts';
import { mergeImport } from '../import/mergeImport.ts';
import type { NamingRule } from '../naming/namingRule.ts';
import { forgetFolder, rememberFolder } from '../repo/rememberedFolder.ts';
import { RepoConnection } from '../repo/repoConnection.svelte.ts';
import { isConfigFile, type RepoFile } from '../repo/repoFiles.ts';
import { findPinnedBand, toRepoConfig } from '../repo/repoImport.ts';
import { SessionValue } from '../ui/sessionValue.svelte.ts';
import { validateConfig } from '../validation/validateConfig.ts';
import type { InitialState } from './initialState.ts';
import { toMergePatch } from './mergePatch.ts';
import { DEFAULT_PRESET, isEmpty, type Preset, toPresetConfig, toPresetName } from './presets.ts';
import { toKindSettings } from './scopePresets.ts';
import { type ResolvedScope, resolveInheritedScope, resolveScope, toReachedKinds } from './scopes.ts';
import { toSavedState } from './shareLink.ts';
import { toGateContext } from './versionGates.ts';
import { type GlobalJsonConfig, type NuGetConfig, PROJECT_KIND_TITLES, type ProjectKind, type ScopeConfig, type Severity, type WizardConfig } from './wizardConfig.ts';

type FrameworkSettings = Pick<ScopeConfig, 'tfms' | 'isTargetFrameworkShared'>;

/**
 * The config being edited and the files it renders to. Folder settings edit the active scope; repo-wide settings, such as
 * the SDK band, nuget.config and global.json, edit the config. Values set to undefined fall back to what the scope inherits.
 */
const RULE_FILTER_DEFAULTS = { searchText: '', source: '', category: '', isConfiguredOnly: false, isCodeFixOnly: false, isUnavailableShown: false };

export class WizardState {
	public catalog: Catalog;
	public config: WizardConfig;
	/** The preset the config started from, which share links store their changes against. */
	public preset = $state<Preset>(DEFAULT_PRESET);
	/** A message about something that went wrong, such as a share link that could not be restored. */
	public notice = $state<string | undefined>(undefined);
	/** Whether the settings are saved in this browser; false while untouched or when storage is blocked. */
	public isSavedInBrowser = $state(false);
	/** The repo folder open in the wizard, which edits save to. */
	public repo = $state.raw<RepoConnection | undefined>(undefined);
	/** The folder opened last, which a reload disconnects; reopening it takes one click instead of finding it again. */
	public rememberedFolder = $state.raw<FileSystemDirectoryHandle | undefined>(undefined);
	/** The folder a new folder goes inside; the dialog for adding one is open while it's set. */
	public addFolderParentPath = $state<string | undefined>(undefined);
	/** The folder files are being imported into; the import dialog is open while it's set. */
	public importTargetPath = $state<string | undefined>(undefined);
	/** How many files and folders the last opened repo had, shown until dismissed. */
	public openedRepoSummary = $state<{ fileCount: number; folderCount: number } | undefined>(undefined);
	/** An action that would wipe changes, waiting for the user to confirm it. */
	public pendingConfirmation = $state<Confirmation | undefined>(undefined);
	public importNotes = $state<(ImportNote & { fileName: string })[]>([]);
	/** The catalog version an imported `.editorconfig` was made with, when it's older than this catalog. */
	public importedCatalogVersion = $state<string | undefined>(undefined);
	public readonly output = $derived.by(() => toGeneratedOutput(this.config, this.catalog, { commentStyle: this.commentStyle, presetName: toPresetName(this.preset) }));
	public readonly savedState = $derived.by(() => toSavedState(this.config, this.preset, this.catalog));
	/** What a project in the active folder actually gets, or undefined at the repo root, where the files are already that. */
	public readonly effectiveFiles = $derived.by(() => (this.isRootActive ? undefined : toEffectiveFiles(this.config, this.activeScope, this.catalog, this.commentStyle, this.output.files)));
	/** Whether the settings differ from the preset they started from, so replacing them loses work. */
	public readonly hasChanges = $derived.by(() => Object.keys(this.savedState.changes as object).length > 0);
	/** Whether the settings are still what a first visit starts with, so there's nothing worth saving or starting over from. */
	public readonly isUntouched = $derived.by(() => !this.hasChanges && this.preset === DEFAULT_PRESET && this.config.versions.sdkBand === DEFAULT_BAND.band);
	public readonly issues = $derived.by(() => validateConfig(this.config, this.catalog, this.output.skippedKeys));
	public readonly resolvedActiveScope: ResolvedScope = $derived.by(() => resolveScope(this.config, this.activeScope));
	/** What the active scope inherits, or undefined for the root scope. */
	public readonly inheritedScope: ResolvedScope | undefined = $derived.by(() => resolveInheritedScope(this.config, this.activeScope));
	/** The kinds of project the active folder's settings reach, which decide the settings it offers. */
	public readonly reachedKinds = $derived.by(() => toReachedKinds(this.config, this.activeScope));
	public readonly activeContext = $derived.by(() => toGateContext(this.resolvedActiveScope, this.catalog));

	/** The generated line the setting being edited writes, which the preview opens and highlights. */
	public linkedLine = $state<SettingLine | undefined>(undefined);
	/** The rule table's filters, which jumping to a rule from the preview sets. */
	public readonly ruleFilters = $state({ ...RULE_FILTER_DEFAULTS });

	// The folder being edited and the comment style survive a reload of the tab; the config itself is in localStorage.
	private readonly savedActiveScopePath = new SessionValue('folder', '');
	private readonly savedCommentStyle = new SessionValue<CommentStyle>('comment-style', 'idAndTitle', { isValid: value => COMMENT_STYLES.includes(value as CommentStyle) });

	public constructor(initialState: InitialState) {
		this.catalog = $state.raw(initialState.catalog);
		this.preset = initialState.restored?.preset ?? this.preset;
		this.config = $state(initialState.restored?.config ?? toPresetConfig(this.preset, initialState.catalog));
		this.notice = initialState.notice;
	}

	/** The folder being edited, or the repo root when the remembered folder no longer exists. */
	public get activeScopePath(): string {
		return this.activeScope.path;
	}

	public set activeScopePath(path: string) {
		this.savedActiveScopePath.value = path;
	}

	public get commentStyle(): CommentStyle {
		return this.savedCommentStyle.value;
	}

	public set commentStyle(commentStyle: CommentStyle) {
		const filesBefore = this.output.files;
		this.savedCommentStyle.value = commentStyle;
		if (this.repo && commentStyle !== 'none') this.repo.markFullyCommented(filesBefore, this.output.files);
	}

	public get rootScope(): ScopeConfig {
		return this.config.scopes[0];
	}

	public get activeScope(): ScopeConfig {
		return this.config.scopes.find(scope => scope.path === this.savedActiveScopePath.value) ?? this.rootScope;
	}

	public get isRootActive(): boolean {
		return this.activeScope === this.rootScope;
	}

	/**
	 * Switches the SDK band. Folders still on the old band's default framework, such as `net10.0` on SDK 10, move to the
	 * new band's; frameworks someone picked by hand stay as they are.
	 */
	public async selectBand(bandName: string): Promise<void> {
		const oldDefaultTfm = `net${this.catalog.band.channel}`;
		this.catalog = await loadCatalog(bandName);
		this.config.versions.sdkBand = bandName;

		const newDefaultTfm = `net${this.catalog.band.channel}`;
		for (const scope of this.config.scopes) {
			if (scope.tfms?.length === 1 && scope.tfms[0] === oldDefaultTfm) scope.tfms = [newDefaultTfm];
		}
	}

	/** Filters the rule table down to one rule, so its row is rendered and can take focus. */
	public showRule(ruleId: string): void {
		Object.assign(this.ruleFilters, { ...RULE_FILTER_DEFAULTS, searchText: ruleId, isUnavailableShown: true });
	}

	/** Asks before an action that discards work, and runs it once the user confirms. */
	public confirm(confirmation: Omit<Confirmation, 'onConfirm'>, action: () => void): void {
		this.pendingConfirmation = { ...confirmation, onConfirm: action };
	}

	/** Runs an action that replaces settings, asking first when there are changes it would lose. */
	public confirmIfChanged(confirmation: Omit<Confirmation, 'onConfirm'>, action: () => void): void {
		if (this.hasChanges) this.confirm(confirmation, action);
		else action();
	}

	/** Replaces the whole config with a preset for the selected SDK band. */
	public applyPreset(preset: Preset): void {
		this.preset = preset;
		this.config = toPresetConfig(preset, this.catalog);
		this.activeScopePath = '';
	}

	/**
	 * Replaces the settings with a repo's config files, on the SDK band its global.json pins. Saving starts from the files
	 * as they are, so nothing is written until a setting changes.
	 */
	public async openRepo(name: string, directory: FileSystemDirectoryHandle | undefined, files: readonly RepoFile[]): Promise<void> {
		const band = findPinnedBand(files, BANDS) ?? this.catalog.band;
		if (band.band !== this.catalog.band.band) this.catalog = await loadCatalog(band.band);

		const { config, notes, preset } = toRepoConfig(files, this.catalog);
		this.preset = preset ?? DEFAULT_PRESET;
		this.config = config;
		this.activeScopePath = '';
		this.importNotes = notes;
		this.importedCatalogVersion = undefined;
		this.repo = new RepoConnection(name, directory, files, this.output.files);
		this.openedRepoSummary = { fileCount: files.filter(file => isConfigFile(file.path)).length, folderCount: config.scopes.length };
	}

	/** Opens the dialog for adding a folder, inside `parentPath` or at the repo root. */
	public askToAddFolder(parentPath = ''): void {
		this.addFolderParentPath = parentPath;
	}

	/** Removes a folder, asking first when it has settings of its own. */
	public askToRemoveScope(path: string): void {
		const scope = this.config.scopes.find(entry => entry.path === path);
		if (!scope || path === '') return;
		if (!Object.keys(scope).some(key => key !== 'path')) {
			this.removeScope(path);
			return;
		}

		this.confirm({ title: `Remove ${path}/?`, message: 'Its settings are deleted. Files already on disk stay.', confirmLabel: 'Remove folder' }, () => this.removeScope(path));
	}

	/** Stops saving to the open repo folder, and forgets it; the settings stay in the browser. */
	public closeRepo(): void {
		this.repo = undefined;
		this.openedRepoSummary = undefined;
		this.forgetRememberedFolder();
	}

	/** Remembers a folder that was opened, in the browser too, so it can be reopened after a reload. */
	public rememberOpenedFolder(directory: FileSystemDirectoryHandle): void {
		this.rememberedFolder = directory;
		void rememberFolder(directory);
	}

	public forgetRememberedFolder(): void {
		this.rememberedFolder = undefined;
		void forgetFolder();
	}

	/** Imports existing files into the active scope, reporting anything changed or dropped. */
	public importFiles(files: readonly { name: string; text: string }[]): void {
		const notes: (ImportNote & { fileName: string })[] = [];
		for (const file of files) {
			const result = importFile(file.name, file.text, this.catalog);
			if (!result) {
				notes.push({ fileName: file.name, severity: 'warning', message: 'Not a file the wizard imports. Use .editorconfig, .globalconfig, .props, .csproj or .ruleset.' });
				continue;
			}

			mergeImport(this.config, this.activeScope, result);
			notes.push(...result.notes.map(note => ({ ...note, fileName: file.name })));
			if (result.catalogVersion && result.catalogVersion < this.catalog.version) this.importedCatalogVersion = result.catalogVersion;
		}

		this.importNotes = notes;
	}

	/** Has analyzers skip a folder's code, or stop skipping it; an ignored folder's compiler warnings don't fail the build either. */
	public setIgnored(path: string, isIgnored: boolean): void {
		const scope = this.config.scopes.find(entry => entry.path === path);
		if (!scope || path === '') return;

		setOrDelete(scope, 'isIgnored', isIgnored ? true : undefined);
		scope.build ??= {};
		setOrDelete(scope.build, 'TreatWarningsAsErrors', isIgnored ? 'false' : undefined);
		if (Object.keys(scope.build).length === 0) delete scope.build;
	}

	public addScope(scope: ScopeConfig): void {
		this.config.scopes.push(structuredClone(scope));
		this.activeScopePath = scope.path;
	}

	public removeScope(path: string): void {
		if (path === '') return;

		this.config.scopes = this.config.scopes.filter(scope => scope.path !== path);
	}

	/** Sets the active scope's target frameworks; undefined makes a nested scope inherit them again. */
	public setTargetFrameworks(tfms: string[] | undefined): void {
		setOrDelete(this.activeScope, 'tfms', tfms);
	}

	/** Sets a build property, or shared target frameworks, for a folder, adding the folder if the wizard doesn't have it yet. */
	public setFolderSetting(path: string, name: string, value: string): void {
		let scope = this.config.scopes.find(entry => entry.path === path);
		if (!scope) {
			this.config.scopes.push({ path });
			scope = this.config.scopes.at(-1) as ScopeConfig;
		}

		if (isFrameworkProperty(name)) {
			scope.tfms = toList(value);
			const isInherited = resolveInheritedScope(this.config, scope)?.isTargetFrameworkShared ?? false;
			setOrDelete(scope, 'isTargetFrameworkShared', isInherited ? undefined : true);
		} else {
			scope.build = { ...scope.build, [name]: value };
		}
	}

	/** Sets TargetFramework for every project in the active folder, or leaves it to each project file. */
	public setTargetFrameworkShared(isShared: boolean): void {
		this.setInheritedSwitch('isTargetFrameworkShared', isShared);
	}

	/** Sets the prefix the repo root adds to every project's assembly name and root namespace, ignoring surrounding spaces and trailing dots. */
	public setProjectNamePrefix(text: string): void {
		setOrDelete(this.config, 'projectNamePrefix', text.trim().replace(/\.+$/, '') || undefined);
	}

	/** Lets each project's test project see its internal types, or stops it. */
	public setInternalsVisibleToTests(isVisible: boolean): void {
		this.setInheritedSwitch('areInternalsVisibleToTests', isVisible);
	}

	/** Has each test project reference the project it tests, or stops it. */
	public setProjectUnderTestReferenced(isReferenced: boolean): void {
		this.setInheritedSwitch('isProjectUnderTestReferenced', isReferenced);
	}

	/**
	 * Sets what a folder holds, with that kind's defaults replacing its settings, asking first when it has some of its own.
	 * The repo root only records the kind, since it holds what every folder shares.
	 */
	public setProjectKind(path: string, projectKind: ProjectKind | undefined): void {
		const scope = this.config.scopes.find(entry => entry.path === path);
		if (!scope) return;
		if (path === '' || projectKind === undefined) {
			setOrDelete(scope, 'projectKind', projectKind);
			return;
		}

		// What the folder holds doesn't change which frameworks its projects target.
		const frameworks = toFrameworkSettings(scope);
		const defaults = { ...toKindSettings(path, projectKind, this.config, this.preset, this.catalog), ...frameworks };
		const useDefaults = () => {
			this.config.scopes = this.config.scopes.map(entry => (entry.path === path ? defaults : entry));
		};
		if (!this.hasOwnSettings(scope, frameworks)) {
			useDefaults();
			return;
		}

		this.confirm(
			{
				title: `Use the defaults for ${PROJECT_KIND_TITLES[projectKind].toLowerCase()} in ${path}/?`,
				message: `They replace the settings ${path}/ sets itself, except its target frameworks.`,
				confirmLabel: 'Use defaults'
			},
			useDefaults
		);
	}

	public setFormatting(glob: string, key: string, value: string | undefined): void {
		this.activeScope.formatting ??= {};
		const formatting = this.activeScope.formatting;
		formatting[glob] ??= {};
		const settings = formatting[glob];
		setOrDelete(settings, key, value);
		if (Object.keys(settings).length === 0) delete formatting[glob];
	}

	public setOption(name: string, value: string | undefined): void {
		this.activeScope.options ??= {};
		setOrDelete(this.activeScope.options, name, value);
	}

	public setSeverity(ruleId: string, severity: Severity | undefined): void {
		this.activeScope.severities ??= {};
		setOrDelete(this.activeScope.severities, ruleId, severity);
	}

	/** Sets the severity of many rules at once, such as every rule a filter shows. */
	public setSeverities(ruleIds: readonly string[], severity: Severity | undefined): void {
		for (const ruleId of ruleIds) this.setSeverity(ruleId, severity);
	}

	/** Sets every analyzer rule in a category, such as Performance. A rule's own severity still wins. */
	public setCategorySeverity(category: string, severity: Severity | undefined): void {
		this.activeScope.categorySeverities ??= {};
		setOrDelete(this.activeScope.categorySeverities, category, severity);
	}

	public setBuildProperty(name: string, value: string | undefined): void {
		this.activeScope.build ??= {};
		setOrDelete(this.activeScope.build, name, value);
	}

	/** Moves a property between every build and CI builds only, keeping its value. */
	public setCiOnly(name: string, isCiOnly: boolean): void {
		const scope = this.activeScope;
		const value = scope.build?.[name] ?? scope.ciBuild?.[name];
		if (value === undefined) return;

		scope.build ??= {};
		scope.ciBuild ??= {};
		setOrDelete(scope.build, name, isCiOnly ? undefined : value);
		setOrDelete(scope.ciBuild, name, isCiOnly ? value : undefined);
	}

	/** Sets a property's value wherever it lives now, so a CI-only property stays CI-only. */
	public setPropertyValue(name: string, value: string | undefined): void {
		const ciBuild = this.activeScope.ciBuild;
		if (ciBuild?.[name] !== undefined) setOrDelete(ciBuild, name, value);
		else this.setBuildProperty(name, value);
	}

	public setAnalysisMode(mode: AnalysisMode): void {
		this.setBuildProperty('AnalysisLevel', toAnalysisLevelValue(mode));
	}

	/** Selects or clears a package; a nested scope's first change copies the list it inherits so it can differ from it. */
	public setPackageSelected(packageId: string, isSelected: boolean): void {
		const packages = this.resolvedActiveScope.packages.filter(existing => existing !== packageId);
		this.activeScope.packages = isSelected ? [...packages, packageId] : packages;
	}

	/** Makes a nested scope use its parent's packages again, or gives it its own copy of them to change. */
	public setInheritsPackages(isInheriting: boolean): void {
		if (isInheriting) delete this.activeScope.packages;
		else this.activeScope.packages = [...this.resolvedActiveScope.packages];
	}

	public addBannedApis(apis: readonly BannedApi[]): void {
		const existing = this.resolvedActiveScope.bannedApis;
		const added = apis.filter(api => !existing.some(entry => entry.symbol === api.symbol));
		this.activeScope.bannedApis = [...(this.activeScope.bannedApis ?? []), ...added];
	}

	public removeBannedApi(symbol: string): void {
		this.activeScope.bannedApis = (this.activeScope.bannedApis ?? []).filter(api => api.symbol !== symbol);
	}

	public addNamingRule(rule: NamingRule): void {
		this.activeScope.naming ??= [];
		this.activeScope.naming.push(structuredClone(rule));
	}

	public removeNamingRule(index: number): void {
		this.activeScope.naming?.splice(index, 1);
	}

	/** Sonar reads a single SonarLint.xml, so rule parameters are repo-wide. */
	public setRuleParameter(ruleId: string, key: string, value: string | undefined): void {
		this.rootScope.ruleParameters ??= {};
		const parameters = this.rootScope.ruleParameters;
		parameters[ruleId] ??= {};
		setOrDelete(parameters[ruleId], key, value);
		if (Object.keys(parameters[ruleId]).length === 0) delete parameters[ruleId];
	}

	public setNuGetConfig(nuget: NuGetConfig | undefined): void {
		setOrDelete(this.config, 'nuget', nuget);
	}

	public setGlobalJson(globalJson: GlobalJsonConfig | undefined): void {
		setOrDelete(this.config, 'globalJson', globalJson);
	}

	public setSeverityFile(severityFile: 'editorconfig' | 'globalconfig'): void {
		setOrDelete(this.config, 'severityFile', severityFile === 'globalconfig' ? severityFile : undefined);
	}

	/** Whether a folder sets anything beyond its current kind's defaults and its frameworks, which a new kind would lose. */
	private hasOwnSettings(scope: ScopeConfig, frameworks: FrameworkSettings): boolean {
		// Clearing a setting can leave an empty object behind, which sets nothing.
		const settings = Object.fromEntries(Object.entries(scope).filter(([key, value]) => key !== 'path' && key !== 'projectKind' && !(key in frameworks) && !isEmpty(value)));
		if (Object.keys(settings).length === 0) return false;
		if (!scope.projectKind) return true;

		const { path: _path, projectKind: _projectKind, ...currentDefaults } = toKindSettings(scope.path, scope.projectKind, this.config, this.preset, this.catalog);
		return toMergePatch(currentDefaults, settings) !== undefined;
	}

	private setInheritedSwitch(key: 'isTargetFrameworkShared' | 'areInternalsVisibleToTests' | 'isProjectUnderTestReferenced', isOn: boolean): void {
		// Turning one off below a folder that turns it on needs an explicit false.
		const isInherited = this.inheritedScope?.[key] ?? false;
		setOrDelete(this.activeScope, key, isOn === isInherited ? undefined : isOn);
	}
}

/** A question to ask before an action that discards work. */
export type Confirmation = { title: string; message: string; confirmLabel: string; onConfirm: () => void };

export const [getWizardState, setWizardState] = createContext<WizardState>();

/** A folder's target frameworks, which stay when what it holds changes. */
function toFrameworkSettings(scope: ScopeConfig): FrameworkSettings {
	const frameworks: FrameworkSettings = {};
	if (scope.tfms) frameworks.tfms = scope.tfms;
	if (scope.isTargetFrameworkShared !== undefined) frameworks.isTargetFrameworkShared = scope.isTargetFrameworkShared;
	return frameworks;
}

function setOrDelete<TRecord extends object, TKey extends keyof TRecord>(record: TRecord, key: TKey, value: TRecord[TKey] | undefined): void {
	if (value === undefined) delete record[key];
	else record[key] = value;
}
