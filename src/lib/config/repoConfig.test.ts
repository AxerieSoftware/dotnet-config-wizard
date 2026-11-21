import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import { toPresetConfigWithSource } from './presets.ts';
import { findRepoConfigProblem, toRepoWizardConfig } from './repoConfig.ts';

const catalog = readCatalog('11.0.1xx');

describe('toRepoWizardConfig', () => {
	it.each(['library', 'service'] as const)('expands a preset with src holding %s projects to the preset itself', kind => {
		const result = toRepoWizardConfig({ preset: 'opinionated', sdkBand: '11.0.1xx', folders: { src: kind, tests: 'test' } }, catalog);

		expect(result).toEqual({ status: 'valid', config: toPresetConfigWithSource('opinionated', kind, catalog) });
	});

	it('applies the changes as a merge patch keyed by folder path, where null removes a setting', () => {
		const result = toRepoWizardConfig(
			{
				preset: 'opinionated',
				sdkBand: '11.0.1xx',
				folders: { src: 'service', tests: 'test' },
				changes: { scopes: { '': { options: { dotnet_style_prefer_conditional_expression_over_return: 'false' } }, src: { build: { EnableAotAnalyzer: null } } } }
			},
			catalog
		);

		expect(result.status).toBe('valid');
		if (result.status !== 'valid') return;
		const [root, src] = result.config.scopes;
		expect(root.options?.dotnet_style_prefer_conditional_expression_over_return).toBe('false');
		expect(src.build?.EnableAotAnalyzer).toBeUndefined();
		expect(src.build?.EnableTrimAnalyzer).toBe('true');
	});

	it("gives a folder that isn't src or tests its kind's defaults", () => {
		const result = toRepoWizardConfig({ preset: 'recommended', sdkBand: '11.0.1xx', folders: { 'src/Api': 'service' } }, catalog);

		expect(result.status === 'valid' && result.config.scopes.map(scope => [scope.path, scope.projectKind])).toEqual([
			['', undefined],
			['src/Api', 'service']
		]);
	});
});

describe('findRepoConfigProblem', () => {
	it('rejects an unknown preset, an unknown kind and the root as a folder', () => {
		expect(findRepoConfigProblem({ preset: 'loose', sdkBand: '11.0.1xx', folders: {} })).toMatch(/^preset must be/);
		expect(findRepoConfigProblem({ preset: 'strict', sdkBand: '11.0.1xx', folders: { src: 'app' } })).toMatch(/^folders must map/);
		expect(findRepoConfigProblem({ preset: 'strict', sdkBand: '11.0.1xx', folders: { '': 'service' } })).toMatch(/below the repo root/);
		expect(findRepoConfigProblem({ preset: 'strict', sdkBand: '11.0.1xx', folders: { src: 'library' } })).toBeUndefined();
	});
});
