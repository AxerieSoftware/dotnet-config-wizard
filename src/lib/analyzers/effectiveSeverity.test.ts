import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import type { ResolvedScope } from '../config/scopes.ts';
import { parseAnalysisLevel } from './analysisLevel.ts';
import { getEffectiveSeverity } from './effectiveSeverity.ts';

const catalog = readCatalog('10.0.4xx');

function toScope(overrides: Partial<ResolvedScope>): ResolvedScope {
	return {
		path: '',
		projectKind: undefined,
		tfms: ['net10.0'],
		formatting: {},
		options: {},
		severities: {},
		categorySeverities: {},
		build: {},
		ciBuild: {},
		naming: [],
		packages: [],
		ruleParameters: {},
		bannedApis: [],
		...overrides
	};
}

function severityOf(ruleId: string, scope: ResolvedScope) {
	const rule = catalog.rules.get(ruleId);
	if (!rule) throw new Error(`Rule ${ruleId} isn't in the catalog.`);
	return getEffectiveSeverity(rule, scope, catalog);
}

describe('getEffectiveSeverity', () => {
	it('uses the configured severity over any default', () => {
		expect(severityOf('CA1822', toScope({ severities: { CA1822: 'error' } }))).toBe('error');
	});

	it('follows the AnalysisLevel mode for CA rules', () => {
		expect(severityOf('CA1062', toScope({}))).toBe('none');
		expect(severityOf('CA1062', toScope({ build: { AnalysisLevel: 'latest-all' } }))).toBe('warning');
	});

	it('keeps the CA rule default when the mode does not list the rule', () => {
		expect(severityOf('CA2016', toScope({}))).toBe('suggestion');
		expect(severityOf('CA2016', toScope({ build: { AnalysisLevel: 'latest-recommended' } }))).toBe('warning');
	});

	it('turns warning-wave compiler warnings on only up to the analysis level', () => {
		expect(severityOf('CS8981', toScope({}))).toBe('warning');
		expect(severityOf('CS8981', toScope({ build: { AnalysisLevel: '6.0' } }))).toBe('none');
	});

	it('applies a category severity to analyzer rules but not to compiler warnings', () => {
		const scope = toScope({ categorySeverities: { Performance: 'error', Compiler: 'none' } });

		expect(severityOf('CA1822', scope)).toBe('error');
		expect(severityOf('CS8981', scope)).toBe('warning');
		expect(severityOf('CA1822', toScope({ categorySeverities: { Performance: 'error' }, severities: { CA1822: 'none' } }))).toBe('none');
	});

	it('reports nothing for a package rule when the scope does not reference the package', () => {
		expect(severityOf('MA0004', toScope({}))).toBe('none');
		expect(severityOf('MA0004', toScope({ packages: ['Meziantou.Analyzer'] }))).toBe('warning');
	});
});

describe('parseAnalysisLevel', () => {
	it.each([
		[undefined, '10', 'default'],
		['latest-recommended', '10', 'recommended'],
		['preview-all', '11', 'all'],
		['9.0-minimum', '9', 'minimum']
	])('reads %s as level %s, mode %s', (value, level, mode) => {
		expect(parseAnalysisLevel(value, catalog.band)).toEqual({ level, mode });
	});
});
