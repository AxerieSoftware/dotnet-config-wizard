/** A JSON value as configs serialize. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * The JSON merge patch (RFC 7386) that turns `source` into `target`: changed values, `null` for removed keys, and arrays
 * replaced whole. Returns undefined when nothing differs.
 */
export function toMergePatch(source: unknown, target: unknown): Json | undefined {
	if (!isObject(source) || !isObject(target)) return isEqual(source, target) ? undefined : (target as Json);

	const patch: Record<string, Json> = {};
	for (const key of new Set([...Object.keys(source), ...Object.keys(target)])) {
		if (!(key in target)) {
			patch[key] = null;
			continue;
		}

		const valuePatch = toMergePatch(source[key], target[key]);
		if (valuePatch !== undefined) patch[key] = valuePatch;
	}

	return Object.keys(patch).length > 0 ? patch : undefined;
}

/** Applies a JSON merge patch to a copy of `target`. */
export function applyMergePatch(target: unknown, patch: unknown): unknown {
	if (!isObject(patch)) return patch;

	const result: Record<string, unknown> = isObject(target) ? { ...target } : {};
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) delete result[key];
		else result[key] = applyMergePatch(result[key], value);
	}

	return result;
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}
