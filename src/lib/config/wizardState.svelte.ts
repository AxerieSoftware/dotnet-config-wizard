import { createContext } from 'svelte';
import type { CommentStyle } from '../analyzers/severityBlocks.ts';
import type { Catalog } from '../catalog/catalog.ts';
import type { BandEntry } from '../catalog/catalogFiles.ts';
import { loadCatalog } from '../catalog/loadCatalog.ts';
import { toEditorConfigFiles } from '../export/editorConfigFiles.ts';
import type { NamingRule } from '../naming/namingRule.ts';
import { resolveScope } from './scopes.ts';
import { toGateContext } from './versionGates.ts';
import type { ProjectKind, ScopeConfig, Severity, WizardConfig } from './wizardConfig.ts';

/** The config being edited and the files it renders to. Values set to undefined go back to the tool's default. */
export class WizardState {
	public catalog: Catalog;
	public config: WizardConfig;
	public commentStyle = $state<CommentStyle>('idAndTitle');
	public readonly output = $derived.by(() => toEditorConfigFiles(this.config, this.catalog, { commentStyle: this.commentStyle }));
	public readonly rootContext = $derived.by(() => toGateContext(resolveScope(this.config, this.rootScope), this.catalog));

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
