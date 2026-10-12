import { createContext } from 'svelte';
import { type AnalysisMode, toAnalysisLevelValue } from '../analyzers/analysisLevel.ts';
import type { BannedApi } from '../analyzers/bannedApis.ts';
import type { CommentStyle } from '../analyzers/severityBlocks.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { loadCatalog } from '../catalog/loadCatalog.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import type { NamingRule } from '../naming/namingRule.ts';
import { validateConfig } from '../validation/validateConfig.ts';
import { type PresetId, toPresetConfig } from './presets.ts';
import { getParentScope, type ResolvedScope, resolveScope } from './scopes.ts';
import { toGateContext } from './versionGates.ts';
import type { GlobalJsonConfig, NuGetConfig, ProjectKind, ScopeConfig, Severity, WizardConfig } from './wizardConfig.ts';

/**
 * The config being edited and the files it renders to. Folder settings edit the active scope; repo-wide settings, such as
 * the SDK band, nuget.config and global.json, edit the config. Values set to undefined fall back to what the scope inherits.
 */
export class WizardState {
	public catalog: Catalog;
	public config: WizardConfig;
	public commentStyle = $state<CommentStyle>('idAndTitle');
	public activeScopePath = $state('');
	/** The preset the config started from, which share links store their changes against. */
	public presetId = $state<PresetId>('microsoft-defaults');
	public readonly output = $derived.by(() => toGeneratedOutput(this.config, this.catalog, { commentStyle: this.commentStyle }));
	public readonly issues = $derived.by(() => validateConfig(this.config, this.catalog, this.output.skippedKeys));
	public readonly resolvedActiveScope: ResolvedScope = $derived.by(() => resolveScope(this.config, this.activeScope));
	/** What the active scope inherits, or undefined for the root scope. */
	public readonly inheritedScope: ResolvedScope | undefined = $derived.by(() => {
		const parent = getParentScope(this.config, this.activeScope);
		return parent ? resolveScope(this.config, parent) : undefined;
	});
	public readonly activeContext = $derived.by(() => toGateContext(this.resolvedActiveScope, this.catalog));

	public constructor(catalog: Catalog) {
		this.catalog = $state.raw(catalog);
		this.config = $state(toPresetConfig(this.presetId, catalog));
	}

	public get rootScope(): ScopeConfig {
		return this.config.scopes[0];
	}

	public get activeScope(): ScopeConfig {
		return this.config.scopes.find(scope => scope.path === this.activeScopePath) ?? this.rootScope;
	}

	public get isRootActive(): boolean {
		return this.activeScope === this.rootScope;
	}

	public async selectBand(bandName: string): Promise<void> {
		this.catalog = await loadCatalog(bandName);
		this.config.versions.sdkBand = bandName;
	}

	/** Replaces the whole config with a preset for the selected SDK band. */
	public applyPreset(presetId: PresetId): void {
		this.presetId = presetId;
		this.config = toPresetConfig(presetId, this.catalog);
		this.activeScopePath = '';
	}

	public addScope(scope: ScopeConfig): void {
		this.config.scopes.push(structuredClone(scope));
		this.activeScopePath = scope.path;
	}

	public removeScope(path: string): void {
		if (path === '') return;

		this.config.scopes = this.config.scopes.filter(scope => scope.path !== path);
		if (this.activeScopePath === path) this.activeScopePath = '';
	}

	/** Sets the active scope's target frameworks; undefined makes a nested scope inherit them again. */
	public setTargetFrameworks(tfms: string[] | undefined): void {
		setOrDelete(this.activeScope, 'tfms', tfms);
	}

	public setProjectKind(projectKind: ProjectKind | undefined): void {
		setOrDelete(this.activeScope, 'projectKind', projectKind);
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
}

export const [getWizardState, setWizardState] = createContext<WizardState>();

function setOrDelete<TRecord extends object, TKey extends keyof TRecord>(record: TRecord, key: TKey, value: TRecord[TKey] | undefined): void {
	if (value === undefined) delete record[key];
	else record[key] = value;
}
