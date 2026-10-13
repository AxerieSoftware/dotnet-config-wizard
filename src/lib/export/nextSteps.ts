import { resolveScope } from '../config/scopes.ts';
import type { WizardConfig } from '../config/wizardConfig.ts';
import type { GeneratedFile } from './generatedFile.ts';

/** The name of the next-steps file in the zip. */
export const NEXT_STEPS_FILE_NAME = 'DOTNET-CONFIG.md';

/** What to do after copying the files in, for the settings this config uses. Each step is one Markdown paragraph. */
export function toNextSteps(config: WizardConfig, files: readonly GeneratedFile[]): string[] {
	const resolvedScopes = config.scopes.map(scope => resolveScope(config, scope));
	const hasFile = (path: string) => files.some(file => file.path === path);
	const isAnyScope = (predicate: (scope: (typeof resolvedScopes)[number]) => boolean) => resolvedScopes.some(predicate);
	const steps = ['Copy the files into the repo root, keeping their folders. Commit them together.'];

	if (hasFile('.editorconfig')) steps.push('Fail pull requests on formatting by running `dotnet format --verify-no-changes` in CI.');
	if (hasFile('Directory.Packages.props'))
		steps.push(
			'Central package management is on: move each `Version` from your projects\' PackageReference items to a `<PackageVersion Include="…" Version="…" />` item in Directory.Packages.props. Otherwise restore fails with NU1008.'
		);
	if (isAnyScope(scope => scope.build.RestorePackagesWithLockFile === 'true'))
		steps.push('Run `dotnet restore` and commit every packages.lock.json. CI restores in locked mode and fails on a missing or stale lock file.');
	if (isAnyScope(scope => scope.packages.includes('Microsoft.CodeAnalysis.PublicApiAnalyzers')))
		steps.push('Add PublicAPI.Shipped.txt and PublicAPI.Unshipped.txt next to each library project, each starting with `#nullable enable`. The RS0016 code fix fills them in.');
	if (isAnyScope(scope => scope.build.PackageReadmeFile !== undefined || scope.build.PackageIcon !== undefined))
		steps.push('Add the README and icon that PackageReadmeFile and PackageIcon name, next to their props file. Packing fails without them.');
	if (isAnyScope(scope => scope.build.UseArtifactsOutput === 'true'))
		steps.push('Build output now goes to one artifacts folder at the repo root. Add `artifacts/` to .gitignore, and update CI paths that read bin/ or obj/.');
	if (hasFile('global.json')) steps.push('Install the SDK that global.json pins on every machine and CI agent. New analyzer rules and warning waves arrive when you update the pin.');
	if (hasFile('nuget.config')) steps.push('nuget.config clears other package sources. Add private feeds to it with the package patterns they serve.');

	return steps;
}

/** The next steps as a Markdown file for the zip download. */
export function toNextStepsMarkdown(steps: readonly string[]): string {
	return `# Next steps\n\n${steps.map(step => `- ${step}`).join('\n')}\n`;
}
