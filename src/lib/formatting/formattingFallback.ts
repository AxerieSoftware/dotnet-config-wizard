import { getParentScope } from '../config/scopes.ts';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import { ALL_FILES_GLOB } from './formattingSections.ts';

/** Where an unset formatting value comes from: the glob that sets it, and whether that's in a folder above. */
export type FormattingFallback = { value: string; glob: string; isInherited: boolean };

/**
 * The value an editor uses when a scope leaves a glob's key unset. EditorConfig applies the files from the repo root down
 * and each file's sections in order, so the last of `[*]` and the glob's own section to set the key, closest folder last,
 * wins.
 */
export function findFormattingFallback(config: WizardConfig, scope: ScopeConfig, glob: string, key: string): FormattingFallback | undefined {
	let fallback: FormattingFallback | undefined;
	for (const candidate of toScopeChain(config, scope)) {
		const isInherited = candidate !== scope;
		const allFilesValue = glob === ALL_FILES_GLOB ? undefined : candidate.formatting?.[ALL_FILES_GLOB]?.[key];
		if (allFilesValue !== undefined) fallback = { value: allFilesValue, glob: ALL_FILES_GLOB, isInherited };

		const ownValue = isInherited ? candidate.formatting?.[glob]?.[key] : undefined;
		if (ownValue !== undefined) fallback = { value: ownValue, glob, isInherited };
	}

	return fallback;
}

/** The scope and every scope above it, from the repo root down. */
function toScopeChain(config: WizardConfig, scope: ScopeConfig): ScopeConfig[] {
	const parent = getParentScope(config, scope);
	return parent ? [...toScopeChain(config, parent), scope] : [scope];
}
