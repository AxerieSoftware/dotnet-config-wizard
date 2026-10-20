import type { WizardState } from '../config/wizardState.svelte.ts';
import { readRepoFiles, readRepoFilesFromList } from './repoFiles.ts';

/**
 * Asks to back up the repo, then lets the user pick its folder. Must run from a click, since browsers only open the
 * folder picker for one. Browsers without folder writing use `fallbackInput`, an `<input webkitdirectory>`.
 */
export function askToOpenRepo(wizard: WizardState, fallbackInput: HTMLInputElement | undefined): void {
	const saving = canSaveToDisk() ? ', saves edits back to the config files, and changes project files only when you apply changes on the Review step' : '';
	const replacing = wizard.hasChanges ? ' This replaces the current settings.' : '';
	wizard.confirm(
		{
			title: 'Back up your repo first',
			message: `The wizard reads the folder's config and project files${saving}. Unmanaged settings are kept, but commit your work in git first so you can undo any change.${replacing}`,
			confirmLabel: 'Choose folder'
		},
		() => {
			if (canSaveToDisk()) void pickFolder(wizard);
			else fallbackInput?.click();
		}
	);
}

/** Opens the folder chosen through the fallback `<input webkitdirectory>`, read-only. */
export async function openFolderFromList(wizard: WizardState, fileList: FileList | null): Promise<void> {
	if (!fileList || fileList.length === 0) return;

	await openWithNotice(wizard, async () => {
		const { name, files } = await readRepoFilesFromList(fileList);
		await wizard.openRepo(name, undefined, files);
	});
}

/**
 * Why an open folder is read-only. Browsers only offer folder saving on secure pages, so plain HTTP on a network address,
 * such as a dev server opened from another machine, loses it even in Chrome or Edge.
 */
export function toReadOnlyReason(): string {
	if (!window.isSecureContext) return 'Saving to a folder needs HTTPS or localhost, and this page is plain HTTP. Download the zip to save for now.';
	return 'This browser can only read folders. Use Chrome or Edge to save to them, or download the zip.';
}

/** Whether this browser can save to a folder on disk; Firefox and Safari can only read one. */
function canSaveToDisk(): boolean {
	return typeof window !== 'undefined' && window.showDirectoryPicker !== undefined;
}

async function pickFolder(wizard: WizardState): Promise<void> {
	let directory: FileSystemDirectoryHandle;
	try {
		directory = await (window.showDirectoryPicker?.({ id: 'repo', mode: 'readwrite' }) ?? Promise.reject(new Error('This browser has no folder picker.')));
	} catch (error) {
		// Closing the picker is a cancel, not a failure.
		if (error instanceof DOMException && error.name === 'AbortError') return;
		wizard.notice = toFailureNotice(error);
		return;
	}

	await openWithNotice(wizard, async () => wizard.openRepo(directory.name, directory, await readRepoFiles(directory)));
}

/** Runs an open, turning a failure such as an unreadable file into a notice. */
async function openWithNotice(wizard: WizardState, open: () => Promise<void>): Promise<void> {
	try {
		await open();
	} catch (error) {
		wizard.notice = toFailureNotice(error);
	}
}

function toFailureNotice(error: unknown): string {
	return `The folder didn't open: ${error instanceof Error ? error.message : String(error)}`;
}
