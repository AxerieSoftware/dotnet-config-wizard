import { describe, expect, it } from 'vitest';
import { readCatalog } from '../../../scripts/readCatalog.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import { checkEditorConfigKeys } from './checkEditorConfigKeys.ts';
import { toExhaustiveConfig } from './exhaustiveConfig.ts';
import { toRootEditorConfig } from './rootEditorConfig.ts';

const catalog = readCatalog('10.0.3xx');

function toConfig(scope: Partial<WizardConfig['scopes'][number]>): WizardConfig {
	return { versions: { sdkBand: '10.0.3xx', langVersion: null }, scopes: [{ path: '', ...scope }] };
}

describe('toRootEditorConfig', () => {
	it('renders every catalog option and build-enforced rule as keys Roslyn reads, with no inline comments', () => {
		const file = toRootEditorConfig(toExhaustiveConfig(catalog), catalog, { commentStyle: 'titleAndLink' });

		expect(file.skippedKeys).toEqual([]);
		expect(checkEditorConfigKeys(file.content, catalog)).toEqual([]);
	});

	it('leaves out and reports keys the catalog does not know', () => {
		const file = toRootEditorConfig(toConfig({ options: { not_an_option: 'true' }, severities: { CA9999: 'warning' } }), catalog, { commentStyle: 'idAndTitle' });

		expect(file.skippedKeys).toEqual(['not_an_option', 'CA9999']);
		expect(file.content).not.toContain('not_an_option');
		expect(file.content).not.toContain('CA9999');
	});

	it('marks rules that only run in the editor', () => {
		const file = toRootEditorConfig(toConfig({ severities: { IDE0003: 'warning', IDE0161: 'warning' } }), catalog, { commentStyle: 'idAndTitle' });

		expect(file.content).toContain('# IDE0003: Name can be simplified (editor only)\ndotnet_diagnostic.IDE0003.severity = warning');
		expect(file.content).toContain('# IDE0161: Convert to file-scoped namespace\ndotnet_diagnostic.IDE0161.severity = warning');
	});

	it('writes no rule comments when comments are turned off', () => {
		const file = toRootEditorConfig(toConfig({ severities: { CA1822: 'warning' } }), catalog, { commentStyle: 'none' });

		expect(file.content).not.toContain('# CA1822');
		expect(file.content).toContain('dotnet_diagnostic.CA1822.severity = warning');
	});

	it('groups options under their catalog group with the rules they feed', () => {
		const file = toRootEditorConfig(toConfig({ options: { dotnet_style_qualification_for_field: 'true', csharp_style_var_elsewhere: 'true' } }), catalog, { commentStyle: 'idAndTitle' });

		expect(file.content).toContain('## this. and Me. qualification (IDE0003, IDE0009)\ndotnet_style_qualification_for_field = true');
		expect(file.content).toContain('## var preferences (IDE0007, IDE0008)\ncsharp_style_var_elsewhere = true');
	});
});
