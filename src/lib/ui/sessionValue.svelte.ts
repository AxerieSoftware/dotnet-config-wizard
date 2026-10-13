const KEY_PREFIX = 'dotnet-config-wizard:';

/**
 * A piece of view state, such as a filter or the folder being edited, kept in sessionStorage so a reload of the same tab
 * restores it. Preferences that should outlast the tab, such as the preview width, pass `isLasting` to use localStorage.
 * A stored value that fails `isValid` is ignored.
 */
export class SessionValue<TValue> {
	private readonly key: string;
	private readonly isLasting: boolean;
	private current: TValue = $state() as TValue;

	public constructor(name: string, initial: TValue, options: { isValid?: (value: unknown) => boolean; isLasting?: boolean } = {}) {
		this.key = `${KEY_PREFIX}${name}`;
		this.isLasting = options.isLasting ?? false;
		const isValid = options.isValid ?? (value => typeof value === typeof initial);
		const stored = readStored(this.getStorage(), this.key);
		this.current = stored !== undefined && isValid(stored) ? (stored as TValue) : initial;
	}

	public get value(): TValue {
		return this.current;
	}

	public set value(value: TValue) {
		this.current = value;
		try {
			this.getStorage()?.setItem(this.key, JSON.stringify(value));
		} catch {
			// Blocked or full storage only costs the restore after a reload.
		}
	}

	/** The storage to use, or undefined where reading it throws, such as when site data is blocked. */
	private getStorage(): Storage | undefined {
		try {
			return this.isLasting ? localStorage : sessionStorage;
		} catch {
			return undefined;
		}
	}
}

/** Forgets every remembered view, such as filters and the folder being edited. */
export function clearSessionValues(): void {
	try {
		for (const key of Object.keys(sessionStorage).filter(name => name.startsWith(KEY_PREFIX))) sessionStorage.removeItem(key);
	} catch {
		// Blocked storage has nothing to forget.
	}
}

function readStored(storage: Storage | undefined, key: string): unknown {
	try {
		const text = storage?.getItem(key) ?? null;
		return text === null ? undefined : JSON.parse(text);
	} catch {
		// Blocked storage or a value that isn't JSON reads as nothing stored.
		return undefined;
	}
}
