import { BUILD_PROPERTIES_BY_NAME } from '../build/buildProperties.ts';
import { isFrameworkProperty, PACK_FILE_PROPERTIES, toFrameworkProperty } from '../build/buildPropsFiles.ts';
import { isSameList, isSameValue, toList } from '../build/msbuildValues.ts';
import { findScopeForFolder, getParentScope, isInFolder, resolveScope } from '../config/scopes.ts';
import { isSupportedTargetFramework } from '../config/targetFrameworks.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import { toFolderPath } from '../export/fileTree.ts';
import type { RepoFile } from '../repo/repoFiles.ts';
import { type DiskConfig, findConditionalSetting, toPlainProperties } from './projectCleanup.ts';

/**
 * A property every project a folder's props would reach sets to the same value, which can become the folder's setting.
 * `isNewFolder` means the wizard doesn't have the folder yet, so it gets added.
 */
export type RepeatedSetting = { folderPath: string; isNewFolder: boolean; name: string; value: string; projectPaths: string[] };

/** A folder a setting could go in: a wizard folder, or a folder just below one that would be added for it. */
type Candidate = { folderPath: string; isNewFolder: boolean; scope: ScopeConfig };

type ProjectProperties = { path: string; properties: Map<string, string> };

/**
 * The settings that could move up into a folder's props. A setting is offered only when every project the folder's props
 * would reach, at least two, already sets that exact value. A folder in between that sets the property takes its projects
 * out of reach; one that sets it only for CI builds, or a props file that sets it under a condition, rules the offer out.
 * Moving it then leaves the projects' lines unnecessary, which the project cleanup offers to remove.
 */
export function findRepeatedSettings(config: WizardConfig, projects: readonly RepoFile[], diskConfig: DiskConfig): RepeatedSetting[] {
	const projectProperties = projects.map(project => ({ path: project.path, properties: toPlainProperties(project.text) }));
	const settings = toCandidates(config, projects).flatMap(candidate => findCandidateSettings(config, candidate, projectProperties, diskConfig));

	// An offer for a folder above that reaches all the same projects makes this one unnecessary.
	return settings.filter(
		setting =>
			!settings.some(
				other =>
					other.name === setting.name &&
					other.value === setting.value &&
					other.folderPath !== setting.folderPath &&
					isInFolder(setting.folderPath, other.folderPath) &&
					setting.projectPaths.every(path => other.projectPaths.includes(path))
			)
	);
}

/**
 * Every wizard folder, plus each folder just below one that holds at least two projects, such as `src` when only the repo
 * root has settings. A new folder starts from what its parent sets.
 */
function toCandidates(config: WizardConfig, projects: readonly RepoFile[]): Candidate[] {
	const scopePaths = new Set(config.scopes.map(scope => scope.path));
	return config.scopes.flatMap(scope => {
		const childFolders = projects
			.map(project => toFolderPath(project.path))
			.filter(folderPath => folderPath !== scope.path && isInFolder(folderPath, scope.path))
			.map(folderPath => folderPath.slice(scope.path === '' ? 0 : scope.path.length + 1).split('/')[0])
			.map(child => (scope.path === '' ? child : `${scope.path}/${child}`));
		const newFolders = [...Map.groupBy(childFolders, folderPath => folderPath)]
			.filter(([folderPath, folders]) => folders.length >= 2 && !scopePaths.has(folderPath))
			.map(([folderPath]) => ({ folderPath, isNewFolder: true, scope }));
		return [{ folderPath: scope.path, isNewFolder: false, scope }, ...newFolders];
	});
}

function findCandidateSettings(config: WizardConfig, candidate: Candidate, projectProperties: readonly ProjectProperties[], diskConfig: DiskConfig): RepeatedSetting[] {
	const { folderPath, isNewFolder, scope } = candidate;
	const resolved = resolveScope(config, scope);
	const projectsBelow = projectProperties.filter(project => isInFolder(toFolderPath(project.path), folderPath));
	const names = new Set(projectsBelow.flatMap(project => [...project.properties.keys()]));

	return [...names].flatMap(name => {
		const reached = toReached(config, candidate, name, projectsBelow);
		const values = (reached ?? []).map(project => project.properties.get(name));
		const value = values[0];
		if (!reached || reached.length < 2 || value === undefined || values.some(other => other === undefined || !isSameValue(other, value))) return [];
		if (reached.some(project => findConditionalSetting(toFolderPath(project.path), name, diskConfig))) return [];

		const settingValue = isFrameworkProperty(name)
			? toFrameworkSetting(name, value, resolved.isTargetFrameworkShared ? resolved.tfms : undefined)
			: toPropertySetting(name, value, folderPath, resolved.build, resolved.ciBuild);
		return settingValue === undefined ? [] : [{ folderPath, isNewFolder, name, value: settingValue, projectPaths: reached.map(project => project.path) }];
	});
}

/**
 * The projects below a folder that its setting for a property would reach, or undefined when the setting would also change
 * a folder below it in a way its projects don't show: one that sets the property only for CI builds, which still inherits
 * it locally, or one with frameworks or sharing of its own, which would start inheriting the other half.
 */
function toReached(config: WizardConfig, { folderPath, scope }: Candidate, name: string, projectsBelow: readonly ProjectProperties[]): ProjectProperties[] | undefined {
	const scopesBelow = config.scopes.filter(other => other !== scope && other.path !== folderPath && isInFolder(other.path, folderPath));
	if (isFrameworkProperty(name)) return scopesBelow.some(other => other.tfms !== undefined || other.isTargetFrameworkShared !== undefined) ? undefined : [...projectsBelow];
	if (scopesBelow.some(other => other.ciBuild?.[name] !== undefined && other.build?.[name] === undefined)) return undefined;
	return projectsBelow.filter(project => !isSetBetween(config, findScopeForFolder(config, toFolderPath(project.path)), scope, name));
}

/** Whether a folder between a project's own and `scope` sets the property, so `scope`'s setting wouldn't reach the project. */
function isSetBetween(config: WizardConfig, projectScope: ScopeConfig, scope: ScopeConfig, name: string): boolean {
	for (let current: ScopeConfig | undefined = projectScope; current && current !== scope; current = getParentScope(config, current)) {
		if (current.build?.[name] !== undefined) return true;
	}

	return false;
}

/** A framework list the folder can share, unless it already shares that one or the wizard doesn't support it. */
function toFrameworkSetting(name: string, value: string, sharedTfms: readonly string[] | undefined): string | undefined {
	const tfms = toList(value);
	if (name !== toFrameworkProperty(tfms) || !tfms.every(isSupportedTargetFramework)) return undefined;
	return sharedTfms && isSameList(tfms, sharedTfms) ? undefined : tfms.join(';');
}

/** A property value the folder can set, spelled the way the wizard offers it, unless the folder already sets it. */
function toPropertySetting(name: string, value: string, folderPath: string, build: Record<string, string>, ciBuild: Record<string, string>): string | undefined {
	const property = BUILD_PROPERTIES_BY_NAME.get(name);
	// List properties add to what they inherit, a CI-only value would still win in CI, and a packed file would be looked for
	// next to the folder's props instead of each project.
	if (!property || property.isList || ciBuild[name] !== undefined || PACK_FILE_PROPERTIES.has(name) || (property.isRepoWide && folderPath !== '')) return undefined;
	// Props are read before the project body, where other properties such as $(OutDir) are still empty, and the value
	// here is raw XML text that would be escaped again.
	if (value.includes('$(') || value.includes('&')) return undefined;
	if (build[name] !== undefined && isSameValue(value, build[name])) return undefined;
	if (property.values.length === 0) return value;
	return property.values.find(allowed => isSameValue(value, allowed));
}
