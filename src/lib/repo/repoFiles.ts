import { GLOBAL_CONFIG_FILE } from '../analyzers/globalConfig.ts';

/** A config file read from a repo, with its path from the repo root, such as `tests/Directory.Build.props`. */
export type RepoFile = { path: string; text: string };

/** The files the wizard reads and writes. Everything else in a repo, code included, is left alone. */
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
	const segments = path.split('/');
	const fileName = segments.at(-1) ?? '';
	// NuGet reads nuget.config in any casing, such as NuGet.Config; MSBuild needs its files' exact names.
	const isConfigName = CONFIG_FILE_NAMES.has(fileName) || fileName.toLowerCase() === 'nuget.config';
	return isConfigName && !segments.slice(0, -1).some(segment => SKIPPED_FOLDERS.has(segment));
}

/** Reads every config file under a folder the user picked, skipping build output and dependencies. */
export async function readConfigFiles(directory: FileSystemDirectoryHandle, prefix = ''): Promise<RepoFile[]> {
	const reads: Promise<RepoFile[]>[] = [];
	for await (const entry of directory.values()) {
		const path = `${prefix}${entry.name}`;
		if (entry.kind === 'directory') {
			if (!SKIPPED_FOLDERS.has(entry.name)) reads.push(readConfigFiles(entry, `${path}/`));
		} else if (isConfigFile(path)) {
			reads.push(entry.getFile().then(async file => [{ path, text: await file.text() }]));
		}
	}

	return (await Promise.all(reads)).flat();
}

/**
 * Reads the config files from a folder chosen through `<input webkitdirectory>`, for browsers that can't write to disk.
 * Paths there start with the chosen folder's name, which is dropped.
 */
export async function readConfigFilesFromList(fileList: FileList): Promise<{ name: string; files: RepoFile[] }> {
	const allFiles = [...fileList];
	const name = allFiles[0]?.webkitRelativePath.split('/')[0] ?? 'repo';
	const files = await Promise.all(
		allFiles
			.map(file => ({ file, path: file.webkitRelativePath.split('/').slice(1).join('/') }))
			.filter(({ path }) => isConfigFile(path))
			.map(async ({ file, path }) => ({ path, text: await file.text() }))
	);
	return { name, files };
}

/** Writes a file under the repo folder, creating any folders on the way. */
export async function writeConfigFile(directory: FileSystemDirectoryHandle, path: string, text: string): Promise<void> {
	const segments = path.split('/');
	let folder = directory;
	for (const segment of segments.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true });

	const file = await folder.getFileHandle(segments.at(-1) ?? path, { create: true });
	const writable = await file.createWritable();
	await writable.write(text);
	await writable.close();
}
