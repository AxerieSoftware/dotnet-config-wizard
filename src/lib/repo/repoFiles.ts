import { GLOBAL_CONFIG_FILE } from '../analyzers/globalConfig.ts';

/** A config or project file read from a repo, with its path from the repo root, such as `tests/Directory.Build.props`. */
export type RepoFile = { path: string; text: string };

/** The config files the wizard reads and saves. Project files are read too, and only changed when the user applies a cleanup. */
const CONFIG_FILE_NAMES = new Set([
	'.editorconfig',
	'Directory.Build.props',
	'Directory.Packages.props',
	'global.json',
	'nuget.config',
	'.gitattributes',
	'BannedSymbols.txt',
	'SonarLint.xml',
	GLOBAL_CONFIG_FILE
]);

// Build output, dependencies and tool folders never hold the repo's own config, and can be huge.
const SKIPPED_FOLDERS = new Set(['.git', '.vs', '.vscode', '.idea', 'bin', 'obj', 'node_modules', 'artifacts', 'packages', 'TestResults', '.cache']);

export function isConfigFile(path: string): boolean {
	const fileName = path.split('/').at(-1) ?? '';
	// NuGet reads nuget.config in any casing, such as NuGet.Config; MSBuild needs its files' exact names.
	const isConfigName = CONFIG_FILE_NAMES.has(fileName) || fileName.toLowerCase() === 'nuget.config';
	return isConfigName && !isInSkippedFolder(path);
}

export function isProjectFile(path: string): boolean {
	return path.endsWith('.csproj') && !isInSkippedFolder(path);
}

/** Reads every config and project file under a folder the user picked, skipping build output and dependencies. */
export async function readRepoFiles(directory: FileSystemDirectoryHandle, prefix = ''): Promise<RepoFile[]> {
	const reads: Promise<RepoFile[]>[] = [];
	for await (const entry of directory.values()) {
		const path = `${prefix}${entry.name}`;
		if (entry.kind === 'directory') {
			if (!SKIPPED_FOLDERS.has(entry.name)) reads.push(readRepoFiles(entry, `${path}/`));
		} else if (isConfigFile(path) || isProjectFile(path)) {
			reads.push(entry.getFile().then(async file => [{ path, text: await file.text() }]));
		}
	}

	return (await Promise.all(reads)).flat();
}

/**
 * Reads the config and project files from a folder chosen through `<input webkitdirectory>`, for browsers that can't write
 * to disk. Paths there start with the chosen folder's name, which is dropped.
 */
export async function readRepoFilesFromList(fileList: FileList): Promise<{ name: string; files: RepoFile[] }> {
	const allFiles = [...fileList];
	const name = allFiles[0]?.webkitRelativePath.split('/')[0] ?? 'repo';
	const files = await Promise.all(
		allFiles
			.map(file => ({ file, path: file.webkitRelativePath.split('/').slice(1).join('/') }))
			.filter(({ path }) => isConfigFile(path) || isProjectFile(path))
			.map(async ({ file, path }) => ({ path, text: await file.text() }))
	);
	return { name, files };
}

function isInSkippedFolder(path: string): boolean {
	return path
		.split('/')
		.slice(0, -1)
		.some(segment => SKIPPED_FOLDERS.has(segment));
}

/** Reads a file under the repo folder as it is on disk now. */
export async function readRepoFile(directory: FileSystemDirectoryHandle, path: string): Promise<string> {
	const segments = path.split('/');
	let folder = directory;
	for (const segment of segments.slice(0, -1)) folder = await folder.getDirectoryHandle(segment);
	return (await (await folder.getFileHandle(segments.at(-1) ?? path)).getFile()).text();
}

/** Writes a file under the repo folder, creating any folders on the way. */
export async function writeRepoFile(directory: FileSystemDirectoryHandle, path: string, text: string): Promise<void> {
	const segments = path.split('/');
	let folder = directory;
	for (const segment of segments.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true });

	const file = await folder.getFileHandle(segments.at(-1) ?? path, { create: true });
	const writable = await file.createWritable();
	await writable.write(text);
	await writable.close();
}
