/** A semicolon-separated MSBuild list, such as `net10.0;net11.0`, as its entries. */
export function toList(value: string): string[] {
	return value
		.split(';')
		.map(entry => entry.trim())
		.filter(entry => entry !== '');
}

/** Whether two lists hold the same entries, in any order. */
export function isSameList(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every(entry => right.includes(entry));
}

/** MSBuild reads `True` and `true` alike; other values compare exactly. */
export function isSameValue(left: string, right: string): boolean {
	const isBoolean = (value: string) => value.toLowerCase() === 'true' || value.toLowerCase() === 'false';
	return left === right || (isBoolean(left) && left.toLowerCase() === right.toLowerCase());
}
