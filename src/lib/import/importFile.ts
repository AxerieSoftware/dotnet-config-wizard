import type { Catalog } from '../catalog/catalog.ts';
import { importEditorConfig } from './editorConfigImport.ts';
import type { ImportResult } from './importResult.ts';
import { importMsBuildFile } from './msbuildImport.ts';
import { importRuleSet } from './rulesetImport.ts';

/** Picks the importer by file name: `.editorconfig` or `.globalconfig`, MSBuild props and targets, or a `.ruleset`. */
export function importFile(fileName: string, text: string, catalog: Catalog): ImportResult | undefined {
	const name = fileName.toLowerCase();
	if (name.endsWith('.editorconfig') || name.endsWith('.globalconfig')) return importEditorConfig(text, catalog);
	if (name.endsWith('.props') || name.endsWith('.targets') || name.endsWith('.csproj')) return importMsBuildFile(text, catalog);
	if (name.endsWith('.ruleset')) return importRuleSet(text, catalog);
	return undefined;
}
