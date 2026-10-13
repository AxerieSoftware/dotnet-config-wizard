import type { ScopeConfig } from '../config/wizardConfig.ts';
import type { GeneratedFile } from './generatedFile.ts';

export type FileNode = { kind: 'file'; path: string; name: string };

/** A folder in the repo. `isScope` is false for a folder that only exists on the way to a deeper one, such as `src` above `src/Legacy`. */
export type FolderNode = { kind: 'folder'; path: string; name: string; isScope: boolean; children: TreeNode[] };

export type TreeNode = FileNode | FolderNode;

/** Lays the generated files out as the repo will hold them, with every folder that has settings, even one that writes no files. */
export function toFileTree(scopes: readonly ScopeConfig[], files: readonly GeneratedFile[]): FolderNode {
	const root: FolderNode = { kind: 'folder', path: '', name: 'Repo root', isScope: true, children: [] };
	const scopePaths = new Set(scopes.map(scope => scope.path));

	for (const scope of scopes.filter(entry => entry.path !== '')) findOrAddFolder(root, scope.path, scopePaths);
	for (const file of files) {
		const folderPath = toFolderPath(file.path);
		const folder = folderPath === '' ? root : findOrAddFolder(root, folderPath, scopePaths);
		folder.children.push({ kind: 'file', path: file.path, name: toFileName(file.path) });
	}

	sortFolders(root);
	return root;
}

/** The folder a file is written to, such as `tests` for `tests/.editorconfig`. */
export function toFolderPath(filePath: string): string {
	const index = filePath.lastIndexOf('/');
	return index === -1 ? '' : filePath.slice(0, index);
}

/** A file's name without its folder, such as `.editorconfig` for `tests/.editorconfig`. */
export function toFileName(filePath: string): string {
	return filePath.slice(filePath.lastIndexOf('/') + 1);
}

/** How a folder is named in the tree and menus: `Repo root`, or its path with a trailing slash. */
export function toFolderName(path: string): string {
	return path === '' ? 'Repo root' : `${path}/`;
}

function findOrAddFolder(root: FolderNode, path: string, scopePaths: ReadonlySet<string>): FolderNode {
	let folder = root;
	let folderPath = '';
	for (const segment of path.split('/')) {
		folderPath = folderPath === '' ? segment : `${folderPath}/${segment}`;
		let child = folder.children.find((node): node is FolderNode => node.kind === 'folder' && node.path === folderPath);
		if (!child) {
			child = { kind: 'folder', path: folderPath, name: segment, isScope: scopePaths.has(folderPath), children: [] };
			folder.children.push(child);
		}
		folder = child;
	}

	return folder;
}

/** Folders come first, by name, as in an editor's explorer; files keep the order the wizard writes them in. */
function sortFolders(folder: FolderNode): void {
	const folders = folder.children.filter(node => node.kind === 'folder').sort((left, right) => left.name.localeCompare(right.name));
	const files = folder.children.filter(node => node.kind === 'file');
	folder.children = [...folders, ...files];
	for (const child of folders) sortFolders(child);
}
