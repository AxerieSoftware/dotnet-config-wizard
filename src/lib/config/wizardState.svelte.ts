import { createContext } from 'svelte';
import { type AnalysisMode, toAnalysisLevelValue } from '../analyzers/analysisLevel.ts';
import type { BannedApi } from '../analyzers/bannedApis.ts';
import type { CommentStyle } from '../analyzers/severityBlocks.ts';
import type { Catalog } from '../catalog/catalog.ts';
import type { BandEntry } from '../catalog/catalogFiles.ts';
import { loadCatalog } from '../catalog/loadCatalog.ts';
import { toGeneratedOutput } from '../export/generatedOutput.ts';
import type { NamingRule } from '../naming/namingRule.ts';
import { type ResolvedScope, resolveScope } from './scopes.ts';
import { toGateContext } from './versionGates.ts';
import type { GlobalJsonConfig, NuGetConfig, ProjectKind, ScopeConfig, Severity, WizardConfig } from './wizardConfig.ts';

/** The config being edited and the files it renders to. Values set to undefined go back to the tool's default. */
export class WizardState {
	public catalog: Catalog;
	public config: WizardConfig;
	public commentStyle = $state<CommentStyle>('idAndTitle');
	public readonly output = $derived.by(() => toGeneratedOutput(this.config, this.catalog, { commentStyle: this.commentStyle }));
	public readonly resolvedRootScope: ResolvedScope = $derived.by(() => resolveScope(this.config, this.rootScope));
	public readonly rootContext = $derived.by(() => toGateContext(this.resolvedRootScope, this.catalog));

	public constructor(catalog: Catalog) {
		this.catalog = $state.raw(catalog);
		this.config = $state(createStarterConfig(catalog.band));
	}

	public get rootScope(): ScopeConfig {
		return this.config.scopes[0];
	}

	public async selectBand(bandName: string): Promise<void> {
		this.catalog = await loadCatalog(bandName);
		this.config.versions.sdkBand = bandName;
	}

	public setRootTargetFrameworks(tfms: string[]): void {
		this.rootScope.tfms = tfms;
	}

	public setRootProjectKind(projectKind: ProjectKind | undefined): void {
		setOrDelete(this.rootScope, 'projectKind', projectKind);
	}

	public setFormatting(glob: string, key: string, value: string | undefined): void {
		this.rootScope.formatting ??= {};
		const formatting = this.rootScope.formatting;
		formatting[glob] ??= {};
		const settings = formatting[glob];
		setOrDelete(settings, key, value);
		if (Object.keys(settings).length === 0) delete formatting[glob];
	}

	public setOption(name: string, value: string | undefined): void {
		this.rootScope.options ??= {};
		setOrDelete(this.rootScope.options, name, value);
	}

	public setSeverity(ruleId: string, severity: Severity | undefined): void {
		this.rootScope.severities ??= {};
		setOrDelete(this.rootScope.severities, ruleId, severity);
	}

	public setBuildProperty(name: string, value: string | undefined): void {
		this.rootScope.build ??= {};
		setOrDelete(this.rootScope.build, name, value);
	}

	/** Moves a property between every build and CI builds only, keeping its value. */
	public setCiOnly(name: string, isCiOnly: boolean): void {
		const value = this.rootScope.build?.[name] ?? this.rootScope.ciBuild?.[name];
		if (value === undefined) return;

		this.rootScope.build ??= {};
		this.rootScope.ciBuild ??= {};
		setOrDelete(this.rootScope.build, name, isCiOnly ? undefined : value);
		setOrDelete(this.rootScope.ciBuild, name, isCiOnly ? value : undefined);
	}

	/** Sets a property's value wherever it lives now, so a CI-only property stays CI-only. */
	public setPropertyValue(name: string, value: string | undefined): void {
		if (this.rootScope.ciBuild?.[name] !== undefined) setOrDelete(this.rootScope.ciBuild, name, value);
		else this.setBuildProperty(name, value);
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

	public setAnalysisMode(mode: AnalysisMode): void {
		this.setBuildProperty('AnalysisLevel', toAnalysisLevelValue(mode));
	}

	public setPackageSelected(packageId: string, isSelected: boolean): void {
		const packages = (this.rootScope.packages ?? []).filter(existing => existing !== packageId);
		this.rootScope.packages = isSelected ? [...packages, packageId] : packages;
	}

	/** Sets the severity of many rules at once, such as every rule a filter shows. */
	public setSeverities(ruleIds: readonly string[], severity: Severity | undefined): void {
		for (const ruleId of ruleIds) this.setSeverity(ruleId, severity);
	}

	public setRuleParameter(ruleId: string, key: string, value: string | undefined): void {
		this.rootScope.ruleParameters ??= {};
		const parameters = this.rootScope.ruleParameters;
		parameters[ruleId] ??= {};
		setOrDelete(parameters[ruleId], key, value);
		if (Object.keys(parameters[ruleId]).length === 0) delete parameters[ruleId];
	}

	public addBannedApis(apis: readonly BannedApi[]): void {
		const existing = this.rootScope.bannedApis ?? [];
		this.rootScope.bannedApis = [...existing, ...apis.filter(api => !existing.some(entry => entry.symbol === api.symbol))];
	}

	public removeBannedApi(symbol: string): void {
		this.rootScope.bannedApis = (this.rootScope.bannedApis ?? []).filter(api => api.symbol !== symbol);
	}

	public addNamingRule(rule: NamingRule): void {
		this.rootScope.naming ??= [];
		this.rootScope.naming.push(structuredClone(rule));
	}

	public removeNamingRule(index: number): void {
		this.rootScope.naming?.splice(index, 1);
	}
}

export const [getWizardState, setWizardState] = createContext<WizardState>();

function createStarterConfig(band: BandEntry): WizardConfig {
	return {
		versions: { sdkBand: band.band },
		scopes: [
			{
				path: '',
				tfms: [`net${band.channel}`],
				formatting: {
					'[*]': { charset: 'utf-8', end_of_line: 'lf', indent_style: 'space', indent_size: '4', insert_final_newline: 'true', trim_trailing_whitespace: 'true' },
					'[*.{yml,yaml}]': { indent_size: '2' }
				}
			}
		]
	};
}

function setOrDelete<TRecord extends object, TKey extends keyof TRecord>(record: TRecord, key: TKey, value: TRecord[TKey] | undefined): void {
	if (value === undefined) delete record[key];
	else record[key] = value;
}
