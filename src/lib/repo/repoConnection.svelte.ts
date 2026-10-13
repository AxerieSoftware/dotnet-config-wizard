import type { Catalog } from '../catalog/catalog.ts';
import type { GeneratedFile } from '../export/generatedFile.ts';
import { toSavedText } from './preserve.ts';
import { type RepoFile, writeConfigFile } from './repoFiles.ts';

export type RepoStatus = 'saved' | 'saving' | 'failed' | 'read-only';

const SAVE_DELAY_MS = 600;

/**
 * A repo folder open in the wizard. Edits save to it automatically, but only files whose generated content changed are
 * written, each merged with what the wizard doesn't manage in the file on disk. Files are never deleted. Without a folder
 * handle, as in browsers that can't write to disk, the repo is read-only and the zip download saves instead.
 */
export class RepoConnection {
	public readonly name: string;
	public status = $state<RepoStatus>('saved');
	public failure = $state<string | undefined>(undefined);
	private readonly directory: FileSystemDirectoryHandle | undefined;
	// The text on disk, and the wizard's own version of each file when it was last read or written.
	private readonly diskTexts: Map<string, string>;
	private readonly savedVersions: Map<string, string>;
	private saveTimer: ReturnType<typeof setTimeout> | undefined;

	public constructor(name: string, directory: FileSystemDirectoryHandle | undefined, files: readonly RepoFile[], generatedFiles: readonly GeneratedFile[]) {
		this.name = name;
		this.directory = directory;
		this.diskTexts = new Map(files.map(file => [file.path, file.text]));
		this.savedVersions = new Map(generatedFiles.map(file => [file.path, file.content]));
		if (!directory) this.status = 'read-only';
	}

	/** Saves the files once edits pause, so a burst of changes writes once. */
	public scheduleSave(files: readonly GeneratedFile[], catalog: Catalog): void {
		if (!this.directory) return;

		const changed = files.filter(file => this.savedVersions.get(file.path) !== file.content);
		if (changed.length === 0) return;

		clearTimeout(this.saveTimer);
		this.status = 'saving';
		this.saveTimer = setTimeout(() => void this.save(changed, catalog), SAVE_DELAY_MS);
	}

	private async save(files: readonly GeneratedFile[], catalog: Catalog): Promise<void> {
		const directory = this.directory;
		if (!directory) return;

		try {
			await Promise.all(
				files.map(async file => {
					const text = toSavedText(file.path, file.content, this.diskTexts.get(file.path), catalog);
					if (text !== this.diskTexts.get(file.path)) await writeConfigFile(directory, file.path, text);
					this.diskTexts.set(file.path, text);
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
}
