import { resolveScope } from '../config/scopes.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import type { GeneratedFile } from './generatedFile.ts';

/** What to do after copying the files in, for the settings this config uses. Each step is one Markdown paragraph. */
export function toNextSteps(config: WizardConfig, files: readonly GeneratedFile[]): string[] {
	const resolvedScopes = config.scopes.map(scope => resolveScope(config, scope));
	const hasFile = (path: string) => files.some(file => file.path === path);
	const isAnyScope = (predicate: (scope: (typeof resolvedScopes)[number]) => boolean) => resolvedScopes.some(predicate);
	const steps = ['Copy the files into the repo root, keeping their folders, and commit them together so everyone builds with the same rules.'];

	if (hasFile('.editorconfig'))
		steps.push('Gate formatting in CI with `dotnet format --verify-no-changes`, so formatting differences fail the pull request instead of showing up as noise in reviews.');
	if (hasFile('Directory.Packages.props'))
		steps.push(
			'Central package management is on: move each `Version` from your projects\' PackageReference items into `<PackageVersion Include="…" Version="…" />` items in Directory.Packages.props, or restore fails with NU1008.'
		);
	if (isAnyScope(scope => scope.build.RestorePackagesWithLockFile === 'true'))
		steps.push('Run `dotnet restore` and commit every packages.lock.json it writes. CI restores in locked mode and fails when a lock file is missing or out of date.');
	if (isAnyScope(scope => scope.packages.includes('Microsoft.CodeAnalysis.PublicApiAnalyzers')))
		steps.push(
			'Add empty PublicAPI.Shipped.txt and PublicAPI.Unshipped.txt files, each starting with `#nullable enable`, next to every library project. Then use the RS0016 code fix to record the public API.'
		);
	if (isAnyScope(scope => scope.build.PackageReadmeFile !== undefined || scope.build.PackageIcon !== undefined))
		steps.push('Add the README and icon that PackageReadmeFile and PackageIcon name, in the folder their props file is in, or packing fails.');
	if (hasFile('global.json')) steps.push('Install the SDK global.json pins on every machine and CI agent. Update the pin to adopt new analyzer rules and warning waves.');
	if (hasFile('nuget.config')) steps.push('nuget.config clears other package sources; add any private feed to it with the package patterns it serves.');

	return steps;
}

/** The next steps as a Markdown file for the zip download. */
export function toNextStepsMarkdown(steps: readonly string[]): string {
	return `# Next steps\n\n${steps.map(step => `- ${step}`).join('\n')}\n`;
}
