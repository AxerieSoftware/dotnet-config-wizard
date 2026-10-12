import { toBannedSymbolsText } from '../analyzers/bannedApis.ts';
import { toSonarLintXml } from '../analyzers/sonarLintXml.ts';
import type { Catalog } from '../catalog/catalog.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import { type EditorConfigOutputOptions, toEditorConfigFiles } from './editorConfigFiles.ts';
import type { GeneratedFile, GeneratedOutput } from './generatedFile.ts';

const BANNED_API_PACKAGE = 'Microsoft.CodeAnalysis.BannedApiAnalyzers';
const SONAR_PACKAGE = 'SonarAnalyzer.CSharp';

/** Every file a config produces: each scope's `.editorconfig`, plus `BannedSymbols.txt` and `SonarLint.xml` where a scope uses those analyzers. */
export function toGeneratedOutput(config: WizardConfig, catalog: Catalog, outputOptions: EditorConfigOutputOptions): GeneratedOutput {
	const editorConfigOutput = toEditorConfigFiles(config, catalog, outputOptions);
	const analyzerFiles = config.scopes.flatMap(scope => {
		const files: GeneratedFile[] = [];
		const directory = scope.path === '' ? '' : `${scope.path}/`;
		const packages = scope.packages ?? [];

		if (packages.includes(BANNED_API_PACKAGE) && (scope.bannedApis ?? []).length > 0) files.push({ path: `${directory}BannedSymbols.txt`, content: toBannedSymbolsText(scope.bannedApis ?? []) });
		if (packages.includes(SONAR_PACKAGE) && Object.keys(scope.ruleParameters ?? {}).length > 0) files.push({ path: `${directory}SonarLint.xml`, content: toSonarLintXml(scope.ruleParameters ?? {}) });

		return files;
	});

	return { files: [...editorConfigOutput.files, ...analyzerFiles], skippedKeys: editorConfigOutput.skippedKeys };
}
