import { describe, expect, it } from 'vitest';
import { getDefaultCSharpVersion, hasApisOf } from './targetFrameworks.ts';

describe('targetFrameworks', () => {
	it.each([
		['net9.0', 'net9.0', true],
		['net8.0', 'net9.0', false],
		['netcoreapp3.1', 'netstandard2.1', true],
		['netstandard2.0', 'netstandard2.1', false],
		['net472', 'netstandard2.0', true],
		['net472', 'netstandard2.1', false],
		['netstandard2.1', 'net6.0', false]
	])('%s has the APIs of %s: %s', (tfm, requiredTfm, expected) => {
		expect(hasApisOf(tfm, requiredTfm)).toBe(expected);
	});

	it.each([
		['net10.0', '14.0'],
		['net8.0', '12.0'],
		['netcoreapp3.1', '8.0'],
		['netstandard2.1', '8.0'],
		['netstandard2.0', '7.3'],
		['net472', '7.3']
	])('%s defaults to C# %s', (tfm, expected) => {
		expect(getDefaultCSharpVersion(tfm)).toBe(expected);
	});
});
