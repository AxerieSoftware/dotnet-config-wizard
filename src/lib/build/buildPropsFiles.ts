import { GLOBAL_CONFIG_FILE } from '../analyzers/globalConfig.ts';
import type { CommentStyle } from '../analyzers/severityBlocks.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { getParentScope, type ResolvedScope, resolveScope } from '../config/scopes.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import type { GeneratedFile, SkippedKey } from '../export/generatedFile.ts';
import { BUILD_PROPERTIES, BUILD_PROPERTIES_BY_NAME, type PropertyFile, toProjectNameCondition } from './buildProperties.ts';
import { toElement, toGroup, toItem, toParentImport, toProjectDocument, type XmlLine } from './msbuildXml.ts';

const BUILD_PROPS = 'Directory.Build.props';
const PACKAGES_PROPS = 'Directory.Packages.props';
const BANNED_API_PACKAGE = 'Microsoft.CodeAnalysis.BannedApiAnalyzers';
const PUBLIC_API_PACKAGE = 'Microsoft.CodeAnalysis.PublicApiAnalyzers';
const SONAR_PACKAGE = 'SonarAnalyzer.CSharp';

// GitHub Actions and most CI services set CI; Azure Pipelines sets TF_BUILD.
const CI_CONDITION = "'$(CI)' == 'true' or '$(TF_BUILD)' == 'true'";
const CI_ONLY_CONDITION = "'$(ContinuousIntegrationBuild)' == 'true'";

export type BuildFilesOutput = { files: GeneratedFile[]; skippedKeys: (SkippedKey & { scopePath: string })[] };

/**
 * `Directory.Build.props` and, under central package management, `Directory.Packages.props` for every scope that sets
 * something. Nested files import their parent, so they only hold what the scope changes.
 */
export function toBuildFiles(config: WizardConfig, catalog: Catalog, commentStyle: CommentStyle): BuildFilesOutput {
	const output: BuildFilesOutput = { files: [], skippedKeys: [] };
	const isCentrallyManaged = resolveScope(config, config.scopes[0]).build.ManagePackageVersionsCentrally === 'true';

	for (const scope of config.scopes) {
		const skippedKeys = [...Object.keys(scope.build ?? {}), ...Object.keys(scope.ciBuild ?? {})]
			.filter(name => !BUILD_PROPERTIES_BY_NAME.has(name))
			.map(name => ({ scopePath: scope.path, key: name, reason: 'Not an MSBuild property the wizard knows' }));
		output.skippedKeys.push(...skippedKeys);

		const buildProps = toBuildProps(config, scope, catalog, commentStyle, isCentrallyManaged);
		if (buildProps) output.files.push({ path: toScopePath(scope, BUILD_PROPS), content: buildProps });

		const packagesProps = isCentrallyManaged ? toPackagesProps(config, scope, catalog, commentStyle) : undefined;
		if (packagesProps) output.files.push({ path: toScopePath(scope, PACKAGES_PROPS), content: packagesProps });
	}

	return output;
}

/** The test project that can see a project's internal types: the project's name plus `.Tests`. */
export const TEST_ASSEMBLY_NAME = '$(AssemblyName).Tests';

/** Every property the generated props can write, so saving to a repo replaces them rather than keeping the old lines. */
export const WRITTEN_PROPERTY_NAMES: ReadonlySet<string> = new Set([...BUILD_PROPERTIES_BY_NAME.keys(), 'ContinuousIntegrationBuild', 'TargetFramework', 'TargetFrameworks']);

function toBuildProps(config: WizardConfig, scope: ScopeConfig, catalog: Catalog, commentStyle: CommentStyle, isCentrallyManaged: boolean): string | undefined {
	const isRoot = scope.path === '';
	const resolved = resolveScope(config, scope);
	const blocks: XmlLine[][] = [
		toGroup('PropertyGroup', 'Target framework', toTargetFrameworkLines(config, scope, resolved)),
		isRoot ? toProjectNameGroup(scope.projectNamePrefix) : [],
		...toPropertyGroups(scope.build ?? {}, 'props', commentStyle),
		isRoot && hasCiSettings(config) ? toGroup('PropertyGroup', 'Continuous integration', [toElement('ContinuousIntegrationBuild', 'true')], CI_CONDITION) : [],
		toGroup('PropertyGroup', 'CI builds only', toPropertyLines(scope.ciBuild ?? {}, 'props', commentStyle), CI_ONLY_CONDITION),
		isCentrallyManaged ? [] : toGroup('ItemGroup', 'Analyzer packages', toPackageItems(config, scope, catalog, 'PackageReference')),
		toGroup('ItemGroup', 'Analyzer files', toAnalyzerFileItems(config, scope, resolved.packages)),
		toGroup('ItemGroup', 'Package files', toPackFileItems(scope.build ?? {})),
		toGroup('ItemGroup', 'Test access', toTestAccessItems(config, scope))
	];

	if (blocks.every(block => block.length === 0)) return undefined;
	return toProjectDocument([isRoot ? [] : toParentImport(BUILD_PROPS), ...blocks]);
}

/** The frameworks a folder sets for its projects, clearing an inherited value that would conflict, such as a single TargetFramework that breaks multi-targeting. */
function toTargetFrameworkLines(config: WizardConfig, scope: ScopeConfig, resolved: ResolvedScope): XmlLine[] {
	const parent = getParentScope(config, scope);
	const inherited = parent ? resolveScope(config, parent) : undefined;
	const inheritedProperty = inherited?.isTargetFrameworkShared ? toFrameworkProperty(inherited.tfms) : undefined;
	if (scope.isTargetFrameworkShared === false && inheritedProperty) return [toElement(inheritedProperty, '')];
	if (!resolved.isTargetFrameworkShared || resolved.tfms.length === 0) return [];
	if (scope.isTargetFrameworkShared === undefined && scope.tfms === undefined) return [];

	const property = toFrameworkProperty(resolved.tfms);
	// Oldest first, the way multi-target lists are usually written, whatever order they were picked in.
	const tfms = [...resolved.tfms].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
	const line = toElement(property, tfms.join(';'));
	if (property === 'TargetFrameworks' && inheritedProperty === 'TargetFramework') return [toElement('TargetFramework', ''), line];
	return [line];
}

/** Prefixes every project's assembly name and root namespace, except projects already named with the prefix. */
function toProjectNameGroup(prefix: string | undefined): XmlLine[] {
	if (!prefix) return [];

	const name = `${prefix}.$(MSBuildProjectName)`;
	return toGroup('PropertyGroup', 'Project names', [toElement('AssemblyName', name), toElement('RootNamespace', name)], toProjectNameCondition(prefix));
}

/** The property a folder's frameworks go in: TargetFramework for one, TargetFrameworks for several. */
export function toFrameworkProperty(tfms: readonly string[]): 'TargetFramework' | 'TargetFrameworks' {
	return tfms.length === 1 ? 'TargetFramework' : 'TargetFrameworks';
}

function toPackagesProps(config: WizardConfig, scope: ScopeConfig, catalog: Catalog, commentStyle: CommentStyle): string | undefined {
	const isRoot = scope.path === '';
	const blocks = [...toPropertyGroups(scope.build ?? {}, 'packages', commentStyle), toGroup('ItemGroup', 'Analyzer packages', toPackageItems(config, scope, catalog, 'GlobalPackageReference'))];

	if (!isRoot && blocks.every(block => block.length === 0)) return undefined;
	return toProjectDocument([isRoot ? [] : toParentImport(PACKAGES_PROPS), ...blocks]);
}

function toPropertyGroups(values: Record<string, string>, file: PropertyFile, commentStyle: CommentStyle): XmlLine[][] {
	const properties = BUILD_PROPERTIES.filter(property => property.file === file && values[property.name] !== undefined);
	return Map.groupBy(properties, property => property.group)
		.entries()
		.map(([group, groupProperties]) =>
			toGroup('PropertyGroup', group, toPropertyLines(Object.fromEntries(groupProperties.map(property => [property.name, values[property.name]])), file, commentStyle))
		)
		.toArray();
}

function toPropertyLines(values: Record<string, string>, file: PropertyFile, commentStyle: CommentStyle): XmlLine[] {
	return BUILD_PROPERTIES.filter(property => property.file === file && values[property.name] !== undefined).flatMap(property => {
		const value = values[property.name];
		const comment = commentStyle === 'none' ? [] : [`<!-- ${property.description.replaceAll('`', '')} -->`];
		return [...comment, toElement(property.name, property.isList ? `$(${property.name});${value}` : value)];
	});
}

/** A scope's analyzer packages, as additions to and removals from what it inherits. */
function toPackageItems(config: WizardConfig, scope: ScopeConfig, catalog: Catalog, itemType: 'PackageReference' | 'GlobalPackageReference'): XmlLine[] {
	if (scope.packages === undefined) return [];

	const parent = getParentScope(config, scope);
	// Analyzers that come with another package, such as xunit.v3, are already referenced through it.
	const isReferenced = (packageId: string) => !catalog.packages.get(packageId)?.includedWith;
	const inherited = (parent ? resolveScope(config, parent).packages : []).filter(isReferenced);
	const packageIds = scope.packages.filter(isReferenced);
	const removed = inherited.filter(packageId => !packageIds.includes(packageId));
	const added = packageIds.filter(packageId => !inherited.includes(packageId));
	// GlobalPackageReference already keeps analyzers out of consumers; a PackageReference needs PrivateAssets for that.
	const privateAssets: Record<string, string> = itemType === 'PackageReference' ? { PrivateAssets: 'all' } : {};

	return [
		...removed.map(packageId => toItem(itemType, { Remove: packageId })),
		...added.map(packageId => toItem(itemType, { Include: packageId, Version: catalog.packages.get(packageId)?.version ?? '', ...privateAssets }))
	];
}

function toAnalyzerFileItems(config: WizardConfig, scope: ScopeConfig, packages: string[]): XmlLine[] {
	const isRoot = scope.path === '';
	const items: XmlLine[] = [];

	if (packages.includes(BANNED_API_PACKAGE) && (scope.bannedApis ?? []).length > 0) items.push(toItem('AdditionalFiles', { Include: '$(MSBuildThisFileDirectory)BannedSymbols.txt' }));
	if (isRoot && packages.includes(SONAR_PACKAGE) && Object.keys(scope.ruleParameters ?? {}).length > 0) items.push(toItem('AdditionalFiles', { Include: '$(MSBuildThisFileDirectory)SonarLint.xml' }));
	if (isRoot && config.severityFile === 'globalconfig' && Object.keys(scope.severities ?? {}).length > 0)
		items.push(toItem('GlobalAnalyzerConfigFiles', { Include: `$(MSBuildThisFileDirectory)${GLOBAL_CONFIG_FILE}` }));
	if (packages.includes(PUBLIC_API_PACKAGE) && !getParentScopePackages(config, scope).includes(PUBLIC_API_PACKAGE)) {
		// The public API analyzer reads these from each project's own folder.
		for (const fileName of ['PublicAPI.Shipped.txt', 'PublicAPI.Unshipped.txt']) {
			items.push(toItem('AdditionalFiles', { Include: `$(MSBuildProjectDirectory)/${fileName}`, Condition: `Exists('$(MSBuildProjectDirectory)/${fileName}')` }));
		}
	}

	return items;
}

/** Packs the README and icon that PackageReadmeFile and PackageIcon name, from the folder the props file is in. */
function toPackFileItems(build: Record<string, string>): XmlLine[] {
	return [build.PackageReadmeFile, build.PackageIcon]
		.filter(fileName => fileName !== undefined)
		.map(fileName => toItem('None', { Include: `$(MSBuildThisFileDirectory)${fileName}`, Pack: 'true', PackagePath: '/', Visible: 'false' }));
}

/** Lets tests see internals where a folder turns it on, and removes the inherited item where a folder turns it off. */
function toTestAccessItems(config: WizardConfig, scope: ScopeConfig): XmlLine[] {
	if (scope.areInternalsVisibleToTests === undefined) return [];

	const parent = getParentScope(config, scope);
	const isInherited = parent ? resolveScope(config, parent).areInternalsVisibleToTests : false;
	if (scope.areInternalsVisibleToTests === isInherited) return [];
	return [toItem('InternalsVisibleTo', scope.areInternalsVisibleToTests ? { Include: TEST_ASSEMBLY_NAME } : { Remove: TEST_ASSEMBLY_NAME })];
}

function getParentScopePackages(config: WizardConfig, scope: ScopeConfig): string[] {
	const parent = getParentScope(config, scope);
	return parent ? resolveScope(config, parent).packages : [];
}

function hasCiSettings(config: WizardConfig): boolean {
	return config.scopes.some(scope => Object.keys(scope.ciBuild ?? {}).length > 0 || scope.build?.Deterministic === 'true');
}

function toScopePath(scope: ScopeConfig, fileName: string): string {
	return scope.path === '' ? fileName : `${scope.path}/${fileName}`;
}
