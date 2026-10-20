import { PROJECTS_UNDER_TEST_FOLDER } from '../build/buildProperties.ts';
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
	if (isAnyScope(scope => scope.build.IsPackable === 'true' && scope.build.VersionPrefix === undefined))
		steps.push("Set `<VersionPrefix>` in each package's project file, such as `1.0.0`, so each package has its own version. A package without one is versioned 1.0.0.");
	const prefix = config.projectNamePrefix;
	if (prefix)
		steps.push(
			`Projects now build as ${prefix}.<project name>, so remove AssemblyName and RootNamespace from project files that only add ${prefix}. Projects named ${prefix} or ${prefix}.<something> are left as they are.`
		);
	if (isAnyScope(scope => scope.isProjectUnderTestReferenced))
		steps.push(
			`Test projects named \`<project>.Tests\` now reference \`${PROJECTS_UNDER_TEST_FOLDER}/<project>/<project>.csproj\` from Directory.Build.props, so remove that ProjectReference from their project files. Keep every other reference.`
		);
	if (isAnyScope(scope => scope.areInternalsVisibleToTests))
		steps.push("Name each test project after the project it tests with `.Tests` on the end, such as `Contoso.Billing.Tests`, so it can use that project's internal types.");
	if (hasFile('global.json')) steps.push('Install the SDK that global.json pins on every machine and CI agent. New analyzer rules and warning waves arrive when you update the pin.');
	if (hasFile('nuget.config')) steps.push('nuget.config clears other package sources. Add private feeds to it with the package patterns they serve.');

	return steps;
}

/** The next steps as a Markdown file for the zip download. */
export function toNextStepsMarkdown(steps: readonly string[]): string {
	return `# Next steps\n\n${steps.map(step => `- ${step}`).join('\n')}\n`;
}
