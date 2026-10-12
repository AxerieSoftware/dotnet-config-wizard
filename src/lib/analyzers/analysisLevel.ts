import type { BandEntry } from '../catalog/catalogFiles.ts';

export const ANALYSIS_MODES = ['none', 'minimum', 'default', 'recommended', 'all'] as const;
export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

const DEFAULT_MODE: AnalysisMode = 'default';

/**
 * Reads an AnalysisLevel value such as `latest-recommended`, `10.0` or `preview-all` into the level number the SDK's
 * files are keyed by and a mode. Unset means `latest`, which for the CA rules is the SDK's own major version.
 */
export function parseAnalysisLevel(value: string | undefined, band: BandEntry): { level: string; mode: AnalysisMode } {
	const [levelPart = 'latest', modePart] = (value ?? 'latest').toLowerCase().split('-');
	const major = Number.parseInt(band.channel, 10);
	const level = levelPart === 'latest' ? String(major) : levelPart === 'preview' ? String(major + 1) : String(Number.parseInt(levelPart, 10));
	const mode = ANALYSIS_MODES.includes(modePart as AnalysisMode) ? (modePart as AnalysisMode) : DEFAULT_MODE;
	return { level, mode };
}

/** Writes a mode back as AnalysisLevel, always tracking the SDK with `latest` so new rules arrive with SDK updates. */
export function toAnalysisLevelValue(mode: AnalysisMode): string | undefined {
	return mode === DEFAULT_MODE ? undefined : `latest-${mode}`;
}
