import { error } from '@sveltejs/kit';
import { findRule, listRules } from '#lib/reference/referenceData.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = async () => (await listRules()).map(rule => ({ id: rule.id }));

export const load: PageServerLoad = async ({ params }) => {
	const reference = await findRule(params.id);
	if (!reference) error(404, `Rule ${params.id} isn't in the catalog.`);
	return reference;
};
