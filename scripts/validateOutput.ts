import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PRESET_LEVELS, SOURCE_KINDS, toPresetConfigWithSource, toPresetName } from '../src/lib/config/presets.ts';
import { parseWizardConfig, type WizardConfig } from '../src/lib/config/wizardConfig.ts';
import { checkEditorConfigKeys } from '../src/lib/export/checkEditorConfigKeys.ts';
import { toExhaustiveConfig } from '../src/lib/export/exhaustiveConfig.ts';
import { toGeneratedOutput } from '../src/lib/export/generatedOutput.ts';
import { DOTNET_DIRECTORY, ensureSdksInstalled } from './dotnetSdks.ts';
import { readBands, readCatalog } from './readCatalog.ts';

// Renders each config into a copy of validation/ and builds it with that band's SDK, checking only for config breakage.
// Code diagnostics in the sample code are expected, and the build exit code is ignored because `severity = error`
// fails projects.
const REPO_ROOT = join(import.meta.dirname, '..');
const SOLUTION = 'Validation.slnx';
const BUILD_LOG = 'build.log';
const CONFIG_BREAKAGE = /\b(?:warning|error) (?<code>AD0001|CS8032|MSB\d{4}|NU1\d{3}|NETSDK\d{4})\b.*$/gm;
const COMPILER_RUN = /\bcsc(?:\.dll)? \/noconfig\b/g;
const TARGET_FRAMEWORK = '<TargetFramework>net10.0</TargetFramework>';
// The xunit sample's own package. Under central package management its version moves to Directory.Packages.props, as it would in a real repo.
const SAMPLE_PACKAGE = { id: 'xunit.v3', version: '4.0.2' };
const DOTNET = join(DOTNET_DIRECTORY, 'dotnet');

// Banned APIs are validated one documentation ID at a time, so the exhaustive config's message for each is its own ID.
type ValidationCase = { name: string; config: WizardConfig; checksBannedApis: boolean };

const dogfoodResult = parseWizardConfig(JSON.parse(readFileSync(join(REPO_ROOT, 'config', 'dogfood.json'), 'utf8')));
if (dogfoodResult.status === 'invalid') throw new Error(`config/dogfood.json isn't a valid wizard config: ${dogfoodResult.reason}`);

const bands = readBands();
await ensureSdksInstalled(bands.map(band => band.sdkVersion));

let failureCount = 0;
for (const band of bands) {
	const catalog = readCatalog(band.band);
	const cases: ValidationCase[] = [{ name: `exhaustive ${band.band}`, config: withGlobalJson(toBannedApisLabeledBySymbol(toExhaustiveConfig(catalog))), checksBannedApis: true }];
	if (!band.isPreview) {
		// Each preset is built with src holding each kind of project, or none. A kind only adds settings at some levels, so variants
		// whose files match one already built are skipped.
		const builtOutputs = new Set<string>();
		for (const preset of PRESET_LEVELS) {
			for (const sourceKind of SOURCE_KINDS) {
				const config = withGlobalJson(toPresetConfigWithSource(preset, sourceKind, catalog));
				const files = JSON.stringify(toGeneratedOutput(config, catalog, { commentStyle: 'none' }).files);
				if (builtOutputs.has(files)) continue;

				builtOutputs.add(files);
				cases.push({ name: `preset ${toPresetName(preset)} with src as ${sourceKind ?? 'any'} ${band.band}`, config, checksBannedApis: false });
			}
		}
		cases.push({ name: `exhaustive with Analyzers.globalconfig ${band.band}`, config: withGlobalJson({ ...toExhaustiveConfig(catalog), severityFile: 'globalconfig' }), checksBannedApis: false });
	}
	if (dogfoodResult.config.versions.sdkBand === band.band) cases.push({ name: `dogfood ${band.band}`, config: withGlobalJson(dogfoodResult.config), checksBannedApis: false });

	for (const validationCase of cases) {
		const problems = validate(validationCase, band.channel);
		failureCount += problems.length;
		console.log(problems.length === 0 ? `✓ ${validationCase.name}` : `✗ ${validationCase.name}\n${problems.map(problem => `  ${problem}`).join('\n')}`);
	}
}

process.exit(failureCount === 0 ? 0 : 1);

function validate(validationCase: ValidationCase, channel: string): string[] {
	const catalog = readCatalog(validationCase.config.versions.sdkBand);
	const workingDirectory = mkdtempSync(join(tmpdir(), 'validate-'));
	cpSync(join(REPO_ROOT, 'validation'), workingDirectory, { recursive: true });

	// Each band builds for its own framework. Restore ignores a TargetFramework passed on the command line, so it's
	// written into the sample projects instead.
	const isCentrallyManaged = validationCase.config.scopes[0].build?.ManagePackageVersionsCentrally === 'true';
	for (const projectPath of findProjects(workingDirectory)) {
		const project = readFileSync(projectPath, 'utf8').replace(TARGET_FRAMEWORK, `<TargetFramework>net${channel}</TargetFramework>`);
		writeFileSync(projectPath, isCentrallyManaged ? project.replace(` Version="${SAMPLE_PACKAGE.version}"`, '') : project);
	}

	const rootScope = validationCase.config.scopes[0];
	const packageIds = rootScope.packages ?? [];

	const output = toGeneratedOutput(validationCase.config, catalog, { commentStyle: 'titleAndLink' });
	const problems = output.skippedKeys.map(skipped => `${skipped.scopePath || '(root)'}: ${skipped.key} was left out (${skipped.reason}).`);
	for (const file of output.files) {
		const path = join(workingDirectory, file.path);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, file.path === 'Directory.Packages.props' ? withSamplePackageVersion(file.content) : file.content);
		if (file.path.endsWith('.editorconfig')) problems.push(...checkEditorConfigKeys(file.content, catalog).map(problem => `${file.path}:${problem.lineNumber}: ${problem.message}`));
	}

	runDotnet(workingDirectory, ['build', SOLUTION, '-p:TreatWarningsAsErrors=false', `-flp:logfile=${BUILD_LOG};verbosity=normal`]);
	const buildLog = readFileSync(join(workingDirectory, BUILD_LOG), 'utf8');
	problems.push(...new Set(buildLog.matchAll(CONFIG_BREAKAGE).map(match => match[0].trim())));

	const projectCount = readFileSync(join(workingDirectory, SOLUTION), 'utf8').match(/\.csproj" \/>/g)?.length ?? 0;
	const compilerRunCount = buildLog.match(COMPILER_RUN)?.length ?? 0;
	if (compilerRunCount !== projectCount) problems.push(`The compiler ran for ${compilerRunCount} of ${projectCount} projects; see ${join(workingDirectory, BUILD_LOG)}.`);

	// A package that fails to load reports nothing, so check every compiler run was handed each package's analyzers.
	// Analyzers that come with a framework package, such as xunit.v3, only load in projects that use it.
	const compilerRuns = buildLog.split('\n').filter(line => line.match(COMPILER_RUN) !== null);
	for (const packageId of packageIds.filter(id => !catalog.packages.get(id)?.includedWith)) {
		const loadedCount = compilerRuns.filter(line => line.toLowerCase().includes(`/${packageId.toLowerCase()}/`)).length;
		if (loadedCount !== projectCount) problems.push(`${packageId} analyzers were passed to ${loadedCount} of ${projectCount} compiler runs.`);
	}

	if (validationCase.checksBannedApis) {
		for (const api of rootScope.bannedApis ?? []) {
			if (!buildLog.includes(`RS0030`) || !buildLog.includes(api.symbol)) problems.push(`Banned API ${api.symbol} didn't trigger RS0030 in the sample code.`);
		}
	}

	runDotnet(workingDirectory, ['format', 'whitespace', SOLUTION]);
	const verify = runDotnet(workingDirectory, ['format', 'whitespace', SOLUTION, '--verify-no-changes']);
	if (verify.status !== 0) problems.push(`A second dotnet format whitespace run still changed files:\n${verify.stdout}${verify.stderr}`);

	return problems;
}

/** Pins the band's SDK through the generated global.json, keeping the repo's MSBuild SDK versions such as MSTest.Sdk. */
function withGlobalJson(config: WizardConfig): WizardConfig {
	const repoGlobalJson = JSON.parse(readFileSync(join(REPO_ROOT, 'global.json'), 'utf8')) as { 'msbuild-sdks'?: Record<string, string> };
	return { ...config, globalJson: { rollForward: 'latestFeature', isTestingPlatformRunner: true, msbuildSdks: repoGlobalJson['msbuild-sdks'] ?? {} } };
}

function withSamplePackageVersion(packagesProps: string): string {
	return packagesProps.replace(
		'</Project>',
		`\t<ItemGroup Label="Sample packages">\n\t\t<PackageVersion Include="${SAMPLE_PACKAGE.id}" Version="${SAMPLE_PACKAGE.version}" />\n\t</ItemGroup>\n</Project>`
	);
}

function findProjects(directory: string): string[] {
	return readdirSync(directory, { recursive: true, encoding: 'utf8' })
		.filter(path => path.endsWith('.csproj'))
		.map(path => join(directory, path));
}

function toBannedApisLabeledBySymbol(config: WizardConfig): WizardConfig {
	const [rootScope, ...otherScopes] = config.scopes;
	return { ...config, scopes: [{ ...rootScope, bannedApis: (rootScope.bannedApis ?? []).map(api => ({ symbol: api.symbol, message: api.symbol })) }, ...otherScopes] };
}

function runDotnet(workingDirectory: string, args: string[]) {
	// CI and TF_BUILD are cleared so CI-only settings, such as locked restore of lock files a fresh sample doesn't have, stay off.
	return spawnSync(DOTNET, args, { cwd: workingDirectory, encoding: 'utf8', env: { ...process.env, DOTNET_ROOT: DOTNET_DIRECTORY, DOTNET_MULTILEVEL_LOOKUP: '0', CI: '', TF_BUILD: '' } });
}
