// A folder handle can't go in localStorage, but IndexedDB can store it, so the folder can be reopened after a reload.
const DATABASE_NAME = 'dotnet-config-wizard';
const DATABASE_VERSION = 1;
const STORE_NAME = 'folders';
const FOLDER_KEY = 'repo';

/** The repo folder opened last, or undefined when there is none or the browser can't store it. */
export async function loadRememberedFolder(): Promise<FileSystemDirectoryHandle | undefined> {
	try {
		const value = await runInStore('readonly', store => store.get(FOLDER_KEY));
		return value instanceof FileSystemDirectoryHandle ? value : undefined;
	} catch {
		// Blocked site data only costs the reopen shortcut.
		return undefined;
	}
}

export async function rememberFolder(directory: FileSystemDirectoryHandle): Promise<void> {
	try {
		await runInStore('readwrite', store => store.put(directory, FOLDER_KEY));
	} catch {
		// Blocked site data only costs the reopen shortcut.
	}
}

export async function forgetFolder(): Promise<void> {
	try {
		await runInStore('readwrite', store => store.delete(FOLDER_KEY));
	} catch {
		// Nothing was stored where site data is blocked.
	}
}

/**
 * Asks to use a remembered folder again; browsers forget the permission between visits, and only ask after a click.
 * Returns whether the folder can be read and written.
 */
export async function requestFolderAccess(directory: FileSystemDirectoryHandle): Promise<boolean> {
	return (await directory.requestPermission({ mode: 'readwrite' })) === 'granted';
}

async function runInStore(mode: IDBTransactionMode, toRequest: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
	const database = await openDatabase();
	try {
		return await toPromise(toRequest(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME)));
	} finally {
		database.close();
	}
}

function openDatabase(): Promise<IDBDatabase> {
	const opening = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
	opening.onupgradeneeded = () => opening.result.createObjectStore(STORE_NAME);
	return toPromise(opening);
}

function toPromise<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
