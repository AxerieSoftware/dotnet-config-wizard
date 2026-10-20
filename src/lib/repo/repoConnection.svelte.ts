import type { Catalog } from '../catalog/catalog.ts';
import type { GeneratedFile } from '../export/generatedFile.ts';
import { type ProjectEdit, toCleanedProjects, toPackagesPropsWithVersions } from '../projects/projectCleanup.ts';
import { toSavedText } from './preserve.ts';
import { isProjectFile, type RepoFile, readRepoFile, writeRepoFile } from './repoFiles.ts';

export type RepoStatus = 'saved' | 'saving' | 'failed' | 'read-only';

/** What applying project file changes did. */
export type ApplyResult = { status: 'applied'; projectCount: number; isPackagesPropsChanged: boolean } | { status: 'changed-on-disk' } | { status: 'failed'; message: string };

const SAVE_DELAY_MS = 600;

/**
 * A repo folder open in the wizard. Edits save to it automatically, but only files whose generated content changed are
 * written, each merged with what the wizard doesn't manage in the file on disk. Project files change only when the user
 * applies changes on the Review step. Files are never deleted. Without a folder handle, as in browsers that can't write to
 * disk, the repo is read-only and the zip download saves instead.
 */
export class RepoConnection {
	public readonly name: string;
	public status = $state<RepoStatus>('saved');
	public failure = $state<string | undefined>(undefined);
	public projectFiles = $state.raw<RepoFile[]>([]);
	private readonly directory: FileSystemDirectoryHandle | undefined;
	// The text on disk, and the wizard's own version of each file when it was last read or written.
	private readonly diskTexts: Map<string, string>;
	private readonly savedVersions: Map<string, string>;
	private saveTimer: ReturnType<typeof setTimeout> | undefined;
	// Saves and applied changes write one after another, so neither works from text the other is about to replace.
	private writes: Promise<unknown> = Promise.resolve();

	public constructor(name: string, directory: FileSystemDirectoryHandle | undefined, files: readonly RepoFile[], generatedFiles: readonly GeneratedFile[]) {
		this.name = name;
		this.directory = directory;
		this.diskTexts = new Map(files.map(file => [file.path, file.text]));
		this.savedVersions = new Map(generatedFiles.map(file => [file.path, file.content]));
		this.projectFiles = files.filter(file => isProjectFile(file.path));
		if (!directory) this.status = 'read-only';
	}

	public get canWrite(): boolean {
		return this.directory !== undefined;
	}

	/** A config or project file's text on disk, as last read or written. */
	public readDiskText(path: string): string | undefined {
		return this.diskTexts.get(this.toDiskPath(path));
	}

	/** What saving a generated file writes: the wizard's version merged with the file on disk. */
	public toSavedFileText(file: GeneratedFile, catalog: Catalog): string {
		return toSavedText(file.path, file.content, this.readDiskText(file.path), catalog);
	}

	/** Saves the files once edits pause, so a burst of changes writes once. */
	public scheduleSave(files: readonly GeneratedFile[], catalog: Catalog): void {
		if (!this.directory) return;

		const changed = files.filter(file => this.savedVersions.get(file.path) !== file.content);
		if (changed.length === 0) return;

		clearTimeout(this.saveTimer);
		this.status = 'saving';
		this.saveTimer = setTimeout(() => void this.enqueue(() => this.save(changed, catalog)), SAVE_DELAY_MS);
	}

	/**
	 * Applies the chosen project file edits, moving package versions into `packagesProps` as it's saved. When a project file
	 * or Directory.Packages.props changed on disk since it was read, nothing is written; the new text is loaded instead, so
	 * the edits can be reviewed again against what's there now.
	 */
	public applyProjectEdits(edits: readonly ProjectEdit[], packagesProps: GeneratedFile | undefined, catalog: Catalog): Promise<ApplyResult> {
		const directory = this.directory;
		if (!directory) throw new Error(`Project edits can't be applied to ${this.name}, which is open read-only.`);

		return this.enqueue(async () => {
			try {
				const editedPaths = new Set(edits.map(edit => edit.projectPath));
				const editedProjects = this.projectFiles.filter(project => editedPaths.has(project.path));
				const current = await Promise.all(editedProjects.map(async project => ({ path: project.path, text: await readRepoFile(directory, project.path) })));
				const packagesPropsOnDisk = packagesProps && this.readDiskText(packagesProps.path);
				const packagesPropsNow = packagesProps && packagesPropsOnDisk !== undefined ? await readRepoFile(directory, this.toDiskPath(packagesProps.path)) : undefined;
				if (current.some((project, index) => project.text !== editedProjects[index].text) || packagesPropsNow !== packagesPropsOnDisk) {
					this.updateProjectFiles(current);
					if (packagesProps && packagesPropsNow !== undefined) this.diskTexts.set(this.toDiskPath(packagesProps.path), packagesPropsNow);
					return { status: 'changed-on-disk' };
				}

				const movedVersions = edits.flatMap(edit => (edit.movedVersion ? [edit.movedVersion] : []));
				const packagesPropsText = packagesProps && movedVersions.length > 0 ? toPackagesPropsWithVersions(this.toSavedFileText(packagesProps, catalog), movedVersions) : undefined;
				const isPackagesPropsChanged = packagesProps !== undefined && packagesPropsText !== undefined && packagesPropsText !== packagesPropsOnDisk;
				// Versions are written before they leave the projects, so a failed write never leaves a package without one.
				if (isPackagesPropsChanged) {
					await this.writeFile(directory, packagesProps.path, packagesPropsText);
					this.savedVersions.set(packagesProps.path, packagesProps.content);
				}

				const projects = toCleanedProjects(current, edits);
				for (const project of projects) {
					await this.writeFile(directory, project.path, project.text);
					this.updateProjectFiles([project]);
				}

				return { status: 'applied', projectCount: projects.length, isPackagesPropsChanged };
			} catch (error) {
				return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
			}
		});
	}

	private async save(files: readonly GeneratedFile[], catalog: Catalog): Promise<void> {
		const directory = this.directory;
		if (!directory) return;

		try {
			await Promise.all(
				files.map(async file => {
					const diskPath = this.toDiskPath(file.path);
					const text = this.toSavedFileText(file, catalog);
					if (text !== this.diskTexts.get(diskPath)) await writeRepoFile(directory, diskPath, text);
					this.diskTexts.set(diskPath, text);
					this.savedVersions.set(file.path, file.content);
				})
			);

			this.status = 'saved';
			this.failure = undefined;
		} catch (error) {
			this.status = 'failed';
			this.failure = error instanceof Error ? error.message : String(error);
		}
	}

	private enqueue<TResult>(write: () => Promise<TResult>): Promise<TResult> {
		const next = this.writes.then(write);
		this.writes = next.catch(() => undefined);
		return next;
	}

	private updateProjectFiles(files: readonly RepoFile[]): void {
		const texts = new Map(files.map(file => [file.path, file.text]));
		this.projectFiles = this.projectFiles.map(project => ({ path: project.path, text: texts.get(project.path) ?? project.text }));
	}

	private async writeFile(directory: FileSystemDirectoryHandle, path: string, text: string): Promise<void> {
		const diskPath = this.toDiskPath(path);
		await writeRepoFile(directory, diskPath, text);
		this.diskTexts.set(diskPath, text);
	}

	/** A file the repo already has, such as NuGet.Config, is saved under its own name rather than beside it. */
	private toDiskPath(path: string): string {
		return this.diskTexts.keys().find(diskPath => diskPath.toLowerCase() === path.toLowerCase()) ?? path;
	}
}
