import type { ProjectKind } from '../config/wizardConfig.ts';

export const PUBLIC_API_PACKAGE = 'Microsoft.CodeAnalysis.PublicApiAnalyzers';
export const MSTEST_PACKAGE = 'MSTest.Analyzers';

/** Analyzer packages that only suit some kinds of project: public API tracking for libraries, test frameworks for tests. */
export const PACKAGE_PROJECT_KINDS: Readonly<Record<string, readonly ProjectKind[]>> = {
	[PUBLIC_API_PACKAGE]: ['library'],
	[MSTEST_PACKAGE]: ['test'],
	'NUnit.Analyzers': ['test'],
	'xunit.analyzers': ['test']
};
