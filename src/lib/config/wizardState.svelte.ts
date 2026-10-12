import { createContext } from 'svelte';
import type { CommentStyle } from '../analyzers/severityBlocks.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { toRootEditorConfig } from '../export/rootEditorConfig.ts';
import type { ScopeConfig, Severity, WizardConfig } from './wizardConfig.ts';

/** The config being edited and the files it renders to. Values set to undefined go back to the tool's default. */
export class WizardState {
	public config = $state<WizardConfig>(createStarterConfig());
	public commentStyle = $state<CommentStyle>('idAndTitle');
	public readonly editorConfig = $derived.by(() => toRootEditorConfig(this.config, this.catalog, { commentStyle: this.commentStyle }));

	public constructor(public readonly catalog: Catalog) {}

	public get rootScope(): ScopeConfig {
		return this.config.scopes[0];
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
}

export const [getWizardState, setWizardState] = createContext<WizardState>();

function createStarterConfig(): WizardConfig {
	return {
		versions: { sdkBand: '10.0.3xx', langVersion: null },
		scopes: [
			{
				path: '',
				formatting: {
					'[*]': { charset: 'utf-8', end_of_line: 'lf', indent_style: 'space', indent_size: '4', insert_final_newline: 'true', trim_trailing_whitespace: 'true' },
					'[*.{yml,yaml}]': { indent_size: '2' }
				}
			}
		]
	};
}

function setOrDelete<TValue>(record: Record<string, TValue>, key: string, value: TValue | undefined): void {
	if (value === undefined) delete record[key];
	else record[key] = value;
}
