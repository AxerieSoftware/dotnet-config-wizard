import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { RepoConnection } from './repoConnection.svelte.ts';

const catalog = readCatalog('10.0.4xx');
const PATH = 'BannedSymbols.txt';
// Longer than the save delay, so a scheduled save starts.
const PAST_SAVE_DELAY_MS = 1000;

/** A one-folder repo whose writes finish only when the test lets them, or fail while `isFailing` is set. */
function toFakeDirectory() {
	const texts = new Map<string, string>();
	const pendingWrites: (() => void)[] = [];
	const disk = { texts, pendingWrites, isFailing: false };
	const directory = {
		getFileHandle: async (name: string) => ({
			createWritable: async () => {
				let written = '';
				return {
					write: async (text: string) => {
						written = text;
					},
					close: () =>
						new Promise<void>((resolve, reject) => {
							if (disk.isFailing) reject(new Error('The disk is full.'));
							else
								pendingWrites.push(() => {
									texts.set(name, written);
									resolve();
								});
						})
				};
			}
		})
	};
	return { disk, directory: directory as unknown as FileSystemDirectoryHandle };
}

async function finishWrites(pendingWrites: (() => void)[]): Promise<void> {
	await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MS);
	while (pendingWrites.length > 0) {
		pendingWrites.shift()?.();
		await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MS);
	}
}

describe('RepoConnection autosave', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('writes an edit undone while its save is writing once that save finishes', async () => {
		const { disk, directory } = toFakeDirectory();
		const repo = new RepoConnection('repo', directory, [{ path: PATH, text: 'T:A;a\n' }], [{ path: PATH, content: 'T:A;a\n' }]);

		repo.scheduleSave([{ path: PATH, content: 'T:B;b\n' }], catalog);
		await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MS);
		repo.scheduleSave([{ path: PATH, content: 'T:A;a\n' }], catalog);

		expect(repo.status).toBe('saving');
		await finishWrites(disk.pendingWrites);
		expect(disk.texts.get(PATH)).toBe('T:A;a\n');
		expect(repo.status).toBe('saved');
	});

	it('shows saved without the old error once a failed edit is undone', async () => {
		const { disk, directory } = toFakeDirectory();
		const repo = new RepoConnection('repo', directory, [{ path: PATH, text: 'T:A;a\n' }], [{ path: PATH, content: 'T:A;a\n' }]);
		disk.isFailing = true;

		repo.scheduleSave([{ path: PATH, content: 'T:B;b\n' }], catalog);
		await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MS);
		expect(repo.status).toBe('failed');
		repo.scheduleSave([{ path: PATH, content: 'T:A;a\n' }], catalog);

		expect(repo.status).toBe('saved');
		expect(repo.failure).toBeUndefined();
	});
});
