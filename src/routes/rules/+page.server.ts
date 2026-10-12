import { listRules } from '#lib/reference/referenceData.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rules = await listRules();
	return { rules: rules.map(rule => ({ id: rule.id, title: rule.title, sourceTitle: rule.sourceTitle })) };
};
