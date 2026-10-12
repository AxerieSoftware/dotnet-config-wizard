/** A configured key the output left out, and why: unknown to the catalog, or not supported by the scope's versions. */
export type SkippedKey = { key: string; reason: string };

/** A generated file at its repo-relative path. */
export type GeneratedFile = { path: string; content: string };

/** Files for a config, plus every configured key that couldn't be written, labeled with its scope. */
export type GeneratedOutput = { files: GeneratedFile[]; skippedKeys: (SkippedKey & { scopePath: string })[] };
