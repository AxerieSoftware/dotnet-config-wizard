import type { ScopeConfig } from '../config/wizardConfig.ts';

export type ImportNote = { severity: 'error' | 'warning' | 'info'; message: string };

/** Settings read from an existing file, ready to merge into a scope, with notes on anything changed or dropped. */
export type ImportResult = { settings: Omit<ScopeConfig, 'path'>; notes: ImportNote[]; catalogVersion?: string };

export const UNMAINTAINED_PREFIXES: readonly { prefix: RegExp; name: string }[] = [
	{ prefix: /^S[AX]\d{4}$/, name: 'StyleCop.Analyzers' },
	{ prefix: /^SCS\d{4}$/, name: 'Security Code Scan' }
];

/** One note per unmaintained analyzer whose rules a file configured, since the wizard doesn't offer them. */
export function toUnmaintainedNotes(ruleIds: readonly string[]): ImportNote[] {
	return UNMAINTAINED_PREFIXES.flatMap(({ prefix, name }) => {
		const matching = ruleIds.filter(id => prefix.test(id));
		return matching.length === 0
			? []
			: [
					{
						severity: 'warning' as const,
						message: `${name} is no longer maintained and predates C# 12, so its ${matching.length} rule settings were dropped. The Analyzers step shows maintained alternatives.`
					}
				];
	});
}
