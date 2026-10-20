import { BUILD_PROPERTIES_BY_NAME, PROJECTS_UNDER_TEST_FOLDER } from '../build/buildProperties.ts';
import { BUILD_PROPS, isFrameworkProperty, PACKAGES_PROPS, toFrameworkProperty } from '../build/buildPropsFiles.ts';
import { isSameList, isSameValue, toList } from '../build/msbuildValues.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { findScopeForFolder, type ResolvedScope, resolveScope } from '../config/scopes.ts';
import { getDefaultCSharpVersion, isSupportedTargetFramework } from '../config/targetFrameworks.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import { toFileName, toFolderPath } from '../export/fileTree.ts';
import type { RepoFile } from '../repo/repoFiles.ts';

/**
 * A change to one line of a project file: removing a setting the generated files make unnecessary, or moving a package's
 * version to Directory.Packages.props. Each says why, so it can be reviewed before it's applied.
 */
export type ProjectEdit = { projectPath: string; lineIndex: number; line: string; reason: string; movedVersion?: PackageVersion };

/** A line that looks redundant but is kept, and why, so the user can decide. */
export type KeptLine = Omit<ProjectEdit, 'movedVersion'>;

export type PackageVersion = { packageId: string; version: string };

export type ProjectCleanup = { edits: ProjectEdit[]; keptLines: KeptLine[] };

/** What the cleanup reads from the repo's config files on disk. */
export type DiskConfig = { packagesPropsText: string | undefined; readText: (path: string) => string | undefined };

const GROUP_START = /^<(?<type>PropertyGroup|ItemGroup)(?<attributes>\s[^>]*)?>$/;
const GROUP_END = /^<\/(?:PropertyGroup|ItemGroup)>$/;
const PROPERTY = /^<(?<name>\w+)>(?<value>[^<]*)<\/\k<name>>$/;
const REFERENCE = /^<(?<type>PackageReference|ProjectReference)\s(?<attributes>[^>]*?)\s*\/>$/;
const ATTRIBUTE = /(\w+)="([^"]*)"/g;
const VERSION_ATTRIBUTE = /\sVersion="[^"]*"/;
const PACKAGE_VERSION_ITEM = /<PackageVersion\s[^>]*>/g;
const CENTRAL_MANAGEMENT_OFF = /<ManagePackageVersionsCentrally>\s*false\s*</i;
const CONDITIONAL_PROPERTY_GROUP = /<PropertyGroup\s[^>]*Condition=[^>]*>(?<body>[\s\S]*?)<\/PropertyGroup>/g;
// The generated analyzer reference has no other metadata, so one with more is the project's own.
const GENERATED_ANALYZER_ATTRIBUTES = new Set(['Include', 'Version', 'PrivateAssets']);
// Asking for the newest C# the compiler knows matches the framework default only when the framework is the SDK's own.
const NEWEST_LANG_VERSIONS = new Set(['default', 'latest', 'latestmajor']);

type ProjectLine = { lineIndex: number; line: string } & (
	| { kind: 'property'; name: string; value: string }
	| { kind: 'reference'; type: 'PackageReference' | 'ProjectReference'; attributes: Record<string, string> }
);

type LineDecision = { status: 'remove'; reason: string } | { status: 'keep'; reason: string } | undefined;

type VersionedReference = { projectPath: string; projectLine: ProjectLine; packageId: string; version: string };

/**
 * The lines in each project file that the generated files, or the compiler's defaults, make unnecessary. Only lines in
 * unconditional groups are offered, and not when the project sets the same property elsewhere or a props file above it sets
 * it under a condition; lines that look redundant but might not be are kept with a reason.
 */
export function findProjectCleanup(config: WizardConfig, catalog: Catalog, allProjects: readonly RepoFile[], diskConfig: DiskConfig): ProjectCleanup {
	// Settings such as LangVersion mean something else in other languages' projects, so only C# projects are cleaned up.
	const projects = allProjects.filter(project => project.path.endsWith('.csproj'));
	const cleanup: ProjectCleanup = { edits: [], keptLines: [] };
	const projectPaths = new Set(projects.map(project => project.path));
	const isRepoCentrallyManaged = resolveScope(config, config.scopes[0]).build.ManagePackageVersionsCentrally === 'true';
	const versionedReferences: VersionedReference[] = [];

	for (const project of projects) {
		const resolved = resolveScope(config, findScopeForFolder(config, toFolderPath(project.path)));
		const projectLines = toProjectLines(project.text);
		// Without a framework of its own, a project's framework is only known when the generated props set it.
		const projectTfms = toProjectTfms(projectLines) ?? (resolved.isTargetFrameworkShared ? resolved.tfms : []);
		const isCentrallyManaged = isRepoCentrallyManaged && !CENTRAL_MANAGEMENT_OFF.test(project.text);
		const decide = (projectLine: ProjectLine, decision: LineDecision) => {
			if (decision?.status === 'remove') cleanup.edits.push(toEdit(project.path, projectLine, decision.reason));
			else if (decision?.status === 'keep') cleanup.keptLines.push({ projectPath: project.path, lineIndex: projectLine.lineIndex, line: projectLine.line, reason: decision.reason });
		};

		for (const projectLine of projectLines) {
			if (projectLine.kind === 'property') {
				// MSBuild uses the last value set, so a line can only go when nothing before or around it sets the same property.
				if (isSetElsewhere(project.text, projectLine)) continue;
				decide(projectLine, decideProperty(projectLine.name, projectLine.value, project.path, resolved, projectTfms, config, catalog, diskConfig));
			} else if (projectLine.type === 'ProjectReference') {
				if (isProjectUnderTest(project.path, projectLine, resolved, projectPaths))
					decide(projectLine, { status: 'remove', reason: `${BUILD_PROPS} references ${PROJECTS_UNDER_TEST_FOLDER}/<name>/<name>.csproj for test projects named <name>.Tests.` });
			} else if (isGeneratedAnalyzer(projectLine.attributes.Include, resolved, catalog)) {
				// Under central package management the generated analyzers are GlobalPackageReference items, which a project
				// that turns it off doesn't get.
				if (isCentrallyManaged === isRepoCentrallyManaged) decide(projectLine, decideAnalyzer(projectLine.attributes, isCentrallyManaged, catalog));
			} else if (isCentrallyManaged && projectLine.attributes.Version !== undefined) {
				versionedReferences.push({ projectPath: project.path, projectLine, packageId: projectLine.attributes.Include, version: projectLine.attributes.Version });
			}
		}
	}

	addVersionMoves(cleanup, versionedReferences, diskConfig.packagesPropsText);
	return cleanup;
}

/** The project files with the chosen edits applied, leaving out groups that end up empty. Only changed files are returned. */
export function toCleanedProjects(projects: readonly RepoFile[], edits: readonly ProjectEdit[]): RepoFile[] {
	return projects.flatMap(project => {
		const projectEdits = new Map(edits.filter(edit => edit.projectPath === project.path).map(edit => [edit.lineIndex, edit]));
		if (projectEdits.size === 0) return [];

		const lines = project.text.split('\n').map((line, lineIndex) => {
			const edit = projectEdits.get(lineIndex);
			if (!edit) return line;
			return edit.movedVersion ? line.replace(VERSION_ATTRIBUTE, '') : undefined;
		});
		return [{ path: project.path, text: withoutEmptiedGroups(lines).join('\n') }];
	});
}

/** Directory.Packages.props with a version item for each moved package it doesn't already have. */
export function toPackagesPropsWithVersions(text: string, versions: readonly PackageVersion[]): string {
	const existingIds = new Set(toPackageVersions(text).keys());
	const items = [...new Map(versions.filter(version => !existingIds.has(version.packageId)).map(version => [version.packageId, version])).values()]
		.sort((left, right) => left.packageId.localeCompare(right.packageId))
		.map(version => `\t\t<PackageVersion Include="${version.packageId}" Version="${version.version}" />`);
	if (items.length === 0) return text;

	const existingGroup = text.indexOf('<ItemGroup Label="Package versions">');
	if (existingGroup !== -1) {
		const groupEnd = text.indexOf('</ItemGroup>', existingGroup);
		const lineStart = text.lastIndexOf('\n', groupEnd) + 1;
		return `${text.slice(0, lineStart)}${items.join('\n')}\n${text.slice(lineStart)}`;
	}

	const closing = text.lastIndexOf('</Project>');
	const group = ['\t<ItemGroup Label="Package versions">', ...items, '\t</ItemGroup>', ''].join('\n');
	return `${text.slice(0, closing).replace(/\n*$/, '\n\n')}${group}${text.slice(closing)}`;
}

/** The properties a project sets once, in an unconditional group and before any import, so their value is the project's. */
export function toPlainProperties(text: string): Map<string, string> {
	return new Map(toProjectLines(text).flatMap(projectLine => (projectLine.kind === 'property' && !isSetElsewhere(text, projectLine) ? [[projectLine.name, projectLine.value] as const] : [])));
}

/** The props file above a folder that sets a property under a condition, which saving keeps as it is. */
export function findConditionalSetting(folderPath: string, name: string, diskConfig: DiskConfig): string | undefined {
	const setting = new RegExp(`<${name}[\\s>/]`);
	const conditionalSetting = new RegExp(`<${name}\\s[^>]*Condition=`);
	return toAncestorPaths(folderPath, BUILD_PROPS).find(path => {
		const text = diskConfig.readText(path) ?? '';
		return conditionalSetting.test(text) || [...text.matchAll(CONDITIONAL_PROPERTY_GROUP)].some(group => setting.test(group.groups?.body ?? ''));
	});
}

function toEdit(projectPath: string, projectLine: ProjectLine, reason: string, movedVersion?: PackageVersion): ProjectEdit {
	return { projectPath, lineIndex: projectLine.lineIndex, line: projectLine.line, reason, movedVersion };
}

function toProjectLines(text: string): ProjectLine[] {
	const projectLines: ProjectLine[] = [];
	let groupType: string | undefined;
	let isGroupConditional = false;
	let isInComment = false;

	for (const [lineIndex, line] of text.split('\n').entries()) {
		const trimmed = line.trim();
		// Commented-out settings are common in project files, and aren't settings at all.
		const commentStart = trimmed.lastIndexOf('<!--');
		const isCommentLine = isInComment || commentStart !== -1;
		isInComment = commentStart === -1 ? isInComment && !trimmed.includes('-->') : !trimmed.includes('-->', commentStart);
		if (isCommentLine) continue;

		const groupStart = GROUP_START.exec(trimmed);
		if (groupStart) {
			groupType = groupStart.groups?.type;
			isGroupConditional = /\sCondition=/.test(groupStart.groups?.attributes ?? '');
			continue;
		}

		if (GROUP_END.test(trimmed)) groupType = undefined;
		if (groupType === undefined || isGroupConditional) continue;

		const property = groupType === 'PropertyGroup' ? PROPERTY.exec(trimmed) : null;
		if (property?.groups) projectLines.push({ kind: 'property', lineIndex, line: trimmed, name: property.groups.name, value: property.groups.value.trim() });

		const reference = groupType === 'ItemGroup' ? REFERENCE.exec(trimmed) : null;
		const attributes = toAttributes(reference?.groups?.attributes ?? '');
		// Update and Remove items change items added elsewhere, so they aren't references of their own.
		const isOwnReference = attributes.Include !== undefined && attributes.Update === undefined && attributes.Remove === undefined;
		if (reference?.groups && isOwnReference && attributes.Condition === undefined && attributes.VersionOverride === undefined)
			projectLines.push({ kind: 'reference', lineIndex, line: trimmed, type: reference.groups.type as 'PackageReference' | 'ProjectReference', attributes });
	}

	return projectLines;
}

function toProjectTfms(projectLines: readonly ProjectLine[]): string[] | undefined {
	const frameworks = projectLines.find(projectLine => projectLine.kind === 'property' && isFrameworkProperty(projectLine.name));
	return frameworks?.kind === 'property' ? toList(frameworks.value) : undefined;
}

/** Whether the project sets the property anywhere else, or imports a file before it that might. */
function isSetElsewhere(text: string, projectLine: ProjectLine & { kind: 'property' }): boolean {
	const settings = text.match(new RegExp(`<${projectLine.name}[\\s>/]`, 'g')) ?? [];
	const textBefore = text.split('\n').slice(0, projectLine.lineIndex).join('\n');
	return settings.length > 1 || /<Import\s/.test(textBefore);
}

function decideProperty(
	name: string,
	value: string,
	projectPath: string,
	resolved: ResolvedScope,
	projectTfms: readonly string[],
	config: WizardConfig,
	catalog: Catalog,
	diskConfig: DiskConfig
): LineDecision {
	if (isFrameworkProperty(name)) {
		const isShared = resolved.isTargetFrameworkShared && name === toFrameworkProperty(resolved.tfms) && isSameList(toList(value), resolved.tfms);
		return isShared ? { status: 'remove', reason: `${BUILD_PROPS} sets ${name} to ${resolved.tfms.join(';')} for this folder.` } : undefined;
	}

	if (name === 'AssemblyName' || name === 'RootNamespace') {
		const prefix = config.projectNamePrefix;
		const projectName = toProjectName(projectPath);
		if (!prefix || projectName === prefix || projectName.startsWith(`${prefix}.`)) return undefined;
		const isPrefixed = value === `${prefix}.${projectName}` || value === `${prefix}.$(MSBuildProjectName)`;
		return isPrefixed ? { status: 'remove', reason: `${BUILD_PROPS} names each project ${prefix}.<project name>.` } : undefined;
	}

	if (name === 'LangVersion') return decideLangVersion(value, toFolderPath(projectPath), projectTfms, catalog, diskConfig);

	const property = BUILD_PROPERTIES_BY_NAME.get(name);
	const generatedValue = resolved.build[name];
	// List properties usually add to what they inherit, so they're never compared.
	if (!property || property.isList || generatedValue === undefined || !isSameValue(value, generatedValue)) return undefined;

	const ciValue = resolved.ciBuild[name];
	if (ciValue !== undefined && !isSameValue(value, ciValue)) return { status: 'keep', reason: `CI builds set ${name} to ${ciValue}, and this line keeps the project at ${value} there.` };
	const conditionalPath = findConditionalSetting(toFolderPath(projectPath), name, diskConfig);
	if (conditionalPath) return { status: 'keep', reason: `${conditionalPath} sets ${name} under a condition, which this line may override.` };
	return { status: 'remove', reason: `${property.file === 'packages' ? PACKAGES_PROPS : BUILD_PROPS} sets ${name} to ${generatedValue} for this folder.` };
}

/** LangVersion is unnecessary when it asks for the C# version the target framework uses anyway, and no props file sets another. */
function decideLangVersion(value: string, folderPath: string, projectTfms: readonly string[], catalog: Catalog, diskConfig: DiskConfig): LineDecision {
	const propsPath = toAncestorPaths(folderPath, BUILD_PROPS).find(path => diskConfig.readText(path)?.includes('<LangVersion'));
	if (propsPath) return { status: 'keep', reason: `${propsPath} sets LangVersion too, so removing this line would change it.` };

	const defaultVersions = [...new Set(projectTfms.map(getDefaultCSharpVersion))];
	const isModernFramework = projectTfms.length > 0 && projectTfms.every(isSupportedTargetFramework);
	const frameworkVersion = isModernFramework && defaultVersions.length === 1 ? defaultVersions[0] : undefined;
	const requested = value.toLowerCase();
	const isDefault =
		frameworkVersion !== undefined &&
		(toCSharpVersion(requested) === frameworkVersion || (NEWEST_LANG_VERSIONS.has(requested) && frameworkVersion === getDefaultCSharpVersion(`net${catalog.band.channel}`)));

	if (isDefault) return { status: 'remove', reason: `The compiler already uses C# ${toShortVersion(frameworkVersion)} for ${projectTfms.join(';')}.` };
	if (frameworkVersion === undefined)
		return { status: 'keep', reason: "The wizard can't tell which C# version this project's frameworks use by default, so this may be needed. Remove it by hand if not." };
	return { status: 'keep', reason: 'Asks for a C# version other than the framework default, so code may rely on it. Remove it by hand if not.' };
}

function decideAnalyzer(attributes: Record<string, string>, isCentrallyManaged: boolean, catalog: Catalog): LineDecision {
	const packageId = attributes.Include;
	const generatedVersion = catalog.packages.get(packageId)?.version;
	const propsFile = isCentrallyManaged ? PACKAGES_PROPS : BUILD_PROPS;
	if (Object.keys(attributes).some(name => !GENERATED_ANALYZER_ATTRIBUTES.has(name)))
		return { status: 'keep', reason: `Sets metadata on ${packageId} that the generated reference doesn't, so it stays the project's own.` };
	if (attributes.Version !== undefined && attributes.Version !== generatedVersion)
		return { status: 'keep', reason: `Pins ${packageId} ${attributes.Version}, and ${propsFile} references ${generatedVersion}. Remove it by hand to use that one.` };
	return { status: 'remove', reason: `${propsFile} references ${packageId} for every project here.` };
}

/** Only a plain reference matches the generated one; aliases or other metadata make it the project's own. */
function isProjectUnderTest(projectPath: string, projectLine: ProjectLine & { kind: 'reference' }, resolved: ResolvedScope, projectPaths: ReadonlySet<string>): boolean {
	const projectName = toProjectName(projectPath);
	if (!resolved.isProjectUnderTestReferenced || !projectName.endsWith('.Tests') || Object.keys(projectLine.attributes).length !== 1) return false;

	const underTest = projectName.slice(0, -'.Tests'.length);
	const expectedPath = `${PROJECTS_UNDER_TEST_FOLDER}/${underTest}/${underTest}.csproj`;
	return projectPaths.has(expectedPath) && toRepoPath(toFolderPath(projectPath), projectLine.attributes.Include) === expectedPath;
}

/** Analyzers that come with another package, such as xunit.v3, aren't referenced by the generated files. */
function isGeneratedAnalyzer(packageId: string, resolved: ResolvedScope, catalog: Catalog): boolean {
	const catalogPackage = catalog.packages.get(packageId);
	return catalogPackage !== undefined && !catalogPackage.includedWith && resolved.packages.includes(packageId);
}

/**
 * Under central package management a PackageReference can't have a Version. Versions every project agrees on move to
 * Directory.Packages.props; disagreements and clashes with a version already there are kept for the user to settle.
 */
function addVersionMoves(cleanup: ProjectCleanup, references: readonly VersionedReference[], packagesPropsText: string | undefined): void {
	const centralVersions = toPackageVersions(packagesPropsText ?? '');

	for (const [packageId, packageReferences] of Map.groupBy(references, reference => reference.packageId)) {
		const versions = [...new Set(packageReferences.map(reference => reference.version))];
		const centralVersion = centralVersions.get(packageId);
		for (const { projectPath, projectLine, version } of packageReferences) {
			const keep = (reason: string) => cleanup.keptLines.push({ projectPath, lineIndex: projectLine.lineIndex, line: projectLine.line, reason });
			if (centralVersion !== undefined && centralVersion !== version) {
				keep(`${PACKAGES_PROPS} has ${packageId} ${centralVersion}. Align them, or use VersionOverride.`);
			} else if (centralVersion === undefined && versions.length > 1) {
				keep(`Projects ask for different versions of ${packageId} (${versions.join(', ')}). Align them so one can move to ${PACKAGES_PROPS}.`);
			} else {
				const reason =
					centralVersion === undefined
						? `Central package management keeps versions in ${PACKAGES_PROPS}, so ${packageId} ${version} goes there. Otherwise restore fails with NU1008.`
						: `${PACKAGES_PROPS} already has ${packageId} ${version}, so the project doesn't need it. Otherwise restore fails with NU1008.`;
				cleanup.edits.push(toEdit(projectPath, projectLine, reason, { packageId, version }));
			}
		}
	}
}

/** The package versions a Directory.Packages.props sets, whatever order the attributes come in. */
function toPackageVersions(text: string): Map<string, string> {
	return new Map(
		[...text.matchAll(PACKAGE_VERSION_ITEM)]
			.map(([item]) => toAttributes(item))
			.filter(attributes => attributes.Include !== undefined && attributes.Version !== undefined)
			.map(attributes => [attributes.Include, attributes.Version])
	);
}

function toAttributes(text: string): Record<string, string> {
	return Object.fromEntries([...text.matchAll(ATTRIBUTE)].map(([, name, value]) => [name, value]));
}

/** The lines left after removals (undefined), without the groups the removals emptied. Groups that were already empty stay. */
function withoutEmptiedGroups(lines: readonly (string | undefined)[]): string[] {
	const result: string[] = [];
	let groupStart: number | undefined;
	let isGroupEdited = false;
	for (const line of lines) {
		if (line === undefined) {
			isGroupEdited = true;
			continue;
		}

		if (GROUP_START.test(line.trim())) {
			groupStart = result.length;
			isGroupEdited = false;
		} else if (GROUP_END.test(line.trim()) && isGroupEdited && groupStart === result.length - 1) {
			result.pop();
			// The blank line that separated the group from the one before it goes too.
			if (result.at(-1)?.trim() === '') result.pop();
			continue;
		}

		result.push(line);
	}

	return result;
}

/** A file in each folder from `folderPath` up to the repo root, nearest first. */
function toAncestorPaths(folderPath: string, fileName: string): string[] {
	const segments = folderPath === '' ? [] : folderPath.split('/');
	return segments.map((_, index) => `${segments.slice(0, segments.length - index).join('/')}/${fileName}`).concat(fileName);
}

/** A path from a project's folder, such as `../../src/Billing/Billing.csproj`, as a path from the repo root. */
function toRepoPath(folderPath: string, relativePath: string): string {
	const segments = folderPath === '' ? [] : folderPath.split('/');
	for (const segment of relativePath.replaceAll('\\', '/').split('/')) {
		if (segment === '..') segments.pop();
		else if (segment !== '.' && segment !== '') segments.push(segment);
	}

	return segments.join('/');
}

function toProjectName(projectPath: string): string {
	return toFileName(projectPath).replace(/\.csproj$/, '');
}

/** `14` and `14.0` both mean C# 14. */
function toCSharpVersion(langVersion: string): string {
	return /^\d+$/.test(langVersion) ? `${langVersion}.0` : langVersion;
}

function toShortVersion(csharpVersion: string): string {
	return csharpVersion.replace(/\.0$/, '');
}
