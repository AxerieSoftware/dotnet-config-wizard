import { strToU8, zipSync } from 'fflate';

/** Packs generated files into a zip, keyed by their repo-relative paths. */
export function toZip(files: readonly { path: string; content: string }[]): Uint8Array<ArrayBuffer> {
	return zipSync(Object.fromEntries(files.map(file => [file.path, strToU8(file.content)]))) as Uint8Array<ArrayBuffer>;
}
