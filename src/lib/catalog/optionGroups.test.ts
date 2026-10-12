import { expect, it } from 'vitest';
import styleOptionCatalog from '../../../catalog/generated/style-options.json';
import { OPTION_GROUPS } from './optionGroups.ts';

it('gives every option group in the generated catalog a title and position', () => {
	const knownGroups = new Set(OPTION_GROUPS.flatMap(group => group.docsGroups));
	const unknownGroups = [...new Set(styleOptionCatalog.options.map(option => option.group))].filter(group => !knownGroups.has(group));

	expect(unknownGroups).toEqual([]);
});
