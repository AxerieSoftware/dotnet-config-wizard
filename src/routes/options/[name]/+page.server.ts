import { error } from '@sveltejs/kit';
import { findOption, listOptions } from '#lib/reference/referenceData.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = async () => (await listOptions()).map(option => ({ name: option.name }));

export const load: PageServerLoad = async ({ params }) => {
	const reference = await findOption(params.name);
	if (!reference) error(404, `Option ${params.name} isn't in the catalog.`);
	return reference;
};
