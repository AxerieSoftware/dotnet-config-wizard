import { describe, expect, it } from 'vitest';
import { toScopePath } from './scopePresets.ts';

describe('toScopePath', () => {
	it.each([
		['tests', 'tests'],
		['/src/Legacy/', 'src/Legacy'],
		['./tools\\Generators', 'tools/Generators'],
		['src//Api', 'src/Api']
	])('normalizes %s to %s', (text, path) => {
		expect(toScopePath(text, [''])).toEqual({ status: 'valid', path });
	});

	it.each([
		['', 'Enter a folder, such as tests or src/Legacy.'],
		['../outside', 'The folder must be inside the repo.'],
		['tests', 'tests already has settings.']
	])('rejects %j', (text, reason) => {
		expect(toScopePath(text, ['', 'tests'])).toEqual({ status: 'invalid', reason });
	});
});
