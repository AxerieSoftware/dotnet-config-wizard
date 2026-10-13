import { toBannedSymbolsText } from '../analyzers/bannedApis.ts';
import { GLOBAL_CONFIG_FILE, toGlobalConfig } from '../analyzers/globalConfig.ts';
import { toSonarLintXml } from '../analyzers/sonarLintXml.ts';
import { toBuildFiles } from '../build/buildPropsFiles.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { resolveScope } from '../config/scopes.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import { toGitAttributes } from '../formatting/gitattributes.ts';
import { toNuGetConfig } from '../packages/nugetConfig.ts';
import { toGlobalJson } from '../sdk/globalJson.ts';
import { type EditorConfigOutputOptions, toEditorConfigFiles } from './editorConfigFiles.ts';
import type { GeneratedFile, GeneratedOutput } from './generatedFile.ts';

const BANNED_API_PACKAGE = 'Microsoft.CodeAnalysis.BannedApiAnalyzers';
const SONAR_PACKAGE = 'SonarAnalyzer.CSharp';

/**
 * Every file a config produces: each scope's `.editorconfig`, `Directory.Build.props` and `Directory.Packages.props`,
 * the analyzer files scopes need, and the repo-level `global.json`, `nuget.config` and `.gitattributes`.
 */
export function toGeneratedOutput(config: WizardConfig, catalog: Catalog, outputOptions: EditorConfigOutputOptions): GeneratedOutput {
	const editorConfigOutput = toEditorConfigFiles(config, catalog, outputOptions);
	const buildOutput = toBuildFiles(config, catalog, outputOptions.commentStyle);
	const [rootScope] = config.scopes;
	const repoFiles: GeneratedFile[] = [];

	const gitAttributes = toGitAttributes(rootScope);
	if (gitAttributes) repoFiles.push({ path: '.gitattributes', content: gitAttributes });
	if (config.globalJson) repoFiles.push({ path: 'global.json', content: toGlobalJson(config.globalJson, catalog.band) });
	if (config.nuget) repoFiles.push({ path: 'nuget.config', content: toNuGetConfig(config.nuget) });
	if (editorConfigOutput.globalConfigBlocks.length > 0) repoFiles.push({ path: GLOBAL_CONFIG_FILE, content: toGlobalConfig(editorConfigOutput.globalConfigBlocks) });

	const analyzerFiles = config.scopes.flatMap(scope => {
		const files: GeneratedFile[] = [];
		const directory = scope.path === '' ? '' : `${scope.path}/`;
		// A folder can inherit the analyzer package, as its props file does.
		const { packages } = resolveScope(config, scope);

		if (packages.includes(BANNED_API_PACKAGE) && (scope.bannedApis ?? []).length > 0) files.push({ path: `${directory}BannedSymbols.txt`, content: toBannedSymbolsText(scope.bannedApis ?? []) });
		// Sonar reads a single SonarLint.xml, so parameters are repo-wide.
		if (scope.path === '' && packages.includes(SONAR_PACKAGE) && Object.keys(scope.ruleParameters ?? {}).length > 0)
			files.push({ path: 'SonarLint.xml', content: toSonarLintXml(scope.ruleParameters ?? {}) });

		return files;
	});

	return {
		files: [...editorConfigOutput.files, ...buildOutput.files, ...analyzerFiles, ...repoFiles],
		skippedKeys: [...editorConfigOutput.skippedKeys, ...buildOutput.skippedKeys]
	};
}
