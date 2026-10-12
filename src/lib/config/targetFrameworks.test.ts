import { describe, expect, it } from 'vitest';
import { getDefaultCSharpVersion, getTargetFrameworksForChannel, isSupportedTargetFramework } from './targetFrameworks.ts';

describe('targetFrameworks', () => {
	it.each([
		['net10.0', true],
		['net11.0-windows', true],
		['net9.0', false],
		['netstandard2.0', false],
		['net472', false]
	])('%s is supported: %s', (tfm, expected) => {
		expect(isSupportedTargetFramework(tfm)).toBe(expected);
	});

	it.each([
		['net10.0', '14.0'],
		['net11.0-android', '15.0']
	])('%s defaults to C# %s', (tfm, expected) => {
		expect(getDefaultCSharpVersion(tfm)).toBe(expected);
	});

	it('offers every supported framework up to the SDK channel, newest first', () => {
		expect(getTargetFrameworksForChannel('11.0')).toEqual(['net11.0', 'net10.0']);
	});
});
