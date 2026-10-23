import { describe, expect, it } from 'vitest';
import { getParentScope, resolveScope, toReachedKinds } from './scopes.ts';
import type { WizardConfig } from './wizardConfig.ts';

const config: WizardConfig = {
	versions: { sdkBand: '10.0.4xx' },
	scopes: [
		{ path: '', projectKind: 'library', tfms: ['net10.0'], formatting: { '[*]': { indent_style: 'tab', end_of_line: 'lf' } }, severities: { CA1707: 'warning', CA2007: 'warning' } },
		{ path: 'tests', projectKind: 'test', formatting: { '[*]': { indent_style: 'space' } }, severities: { CA1707: 'none' } },
		{ path: 'tests/Legacy', tfms: ['net8.0'] },
		{ path: 'testsuite' }
	]
};

describe('scopes', () => {
	it('finds the closest containing folder as the parent', () => {
		expect(getParentScope(config, config.scopes[2])?.path).toBe('tests');
	});

	it('does not treat a folder with a shared name prefix as a parent', () => {
		expect(getParentScope(config, config.scopes[3])?.path).toBe('');
	});

	it('layers a nested scope over everything it inherits', () => {
		const resolved = resolveScope(config, config.scopes[2]);

		expect(resolved.projectKind).toBe('test');
		expect(resolved.tfms).toEqual(['net8.0']);
		expect(resolved.formatting['[*]']).toEqual({ indent_style: 'space', end_of_line: 'lf' });
		expect(resolved.severities).toEqual({ CA1707: 'none', CA2007: 'warning' });
	});
});

describe('toReachedKinds', () => {
	const layout: WizardConfig = {
		versions: { sdkBand: '10.0.4xx' },
		scopes: [{ path: '' }, { path: 'src', projectKind: 'library' }, { path: 'src/Api', projectKind: 'service' }, { path: 'tests', projectKind: 'test' }, { path: 'tools' }]
	};

	it('collects the kinds of a folder and every folder inside it, leaving out folders of no known kind', () => {
		expect(toReachedKinds(layout, layout.scopes[0])).toEqual(['library', 'service', 'test']);
		expect(toReachedKinds(layout, layout.scopes[1])).toEqual(['library', 'service']);
		expect(toReachedKinds(layout, layout.scopes[3])).toEqual(['test']);
		expect(toReachedKinds(layout, layout.scopes[4])).toEqual([]);
	});
});
