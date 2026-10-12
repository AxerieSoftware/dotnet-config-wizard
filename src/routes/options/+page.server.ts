import { listOptions } from '#lib/reference/referenceData.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const options = await listOptions();
	return { options: options.map(option => ({ name: option.name, groupTitle: option.groupTitle, groupOrder: option.groupOrder })) };
};
