import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseWizardConfig, type WizardConfig } from '../src/lib/config/wizardConfig.ts';
import { checkEditorConfigKeys } from '../src/lib/export/checkEditorConfigKeys.ts';
import { toEditorConfigFiles } from '../src/lib/export/editorConfigFiles.ts';
import { toExhaustiveConfig } from '../src/lib/export/exhaustiveConfig.ts';
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
const DOTNET = join(DOTNET_DIRECTORY, 'dotnet');

type ValidationCase = { name: string; config: WizardConfig };

const dogfoodResult = parseWizardConfig(JSON.parse(readFileSync(join(REPO_ROOT, 'config', 'dogfood.json'), 'utf8')));
if (dogfoodResult.status === 'invalid') throw new Error(`config/dogfood.json isn't a valid wizard config: ${dogfoodResult.reason}`);

const bands = readBands();
await ensureSdksInstalled(bands.map(band => band.sdkVersion));

let failureCount = 0;
for (const band of bands) {
	const catalog = readCatalog(band.band);
	const cases: ValidationCase[] = [{ name: `exhaustive ${band.band}`, config: toExhaustiveConfig(catalog) }];
	if (dogfoodResult.config.versions.sdkBand === band.band) cases.push({ name: `dogfood ${band.band}`, config: dogfoodResult.config });

	for (const validationCase of cases) {
		const problems = validate(validationCase, band.sdkVersion, band.channel);
		failureCount += problems.length;
		console.log(problems.length === 0 ? `✓ ${validationCase.name}` : `✗ ${validationCase.name}\n${problems.map(problem => `  ${problem}`).join('\n')}`);
	}
}

process.exit(failureCount === 0 ? 0 : 1);

function validate(validationCase: ValidationCase, sdkVersion: string, channel: string): string[] {
	const catalog = readCatalog(validationCase.config.versions.sdkBand);
	const workingDirectory = mkdtempSync(join(tmpdir(), 'validate-'));
	cpSync(join(REPO_ROOT, 'validation'), workingDirectory, { recursive: true });

	// Restore ignores a TargetFramework passed on the command line, so the band's framework goes into the props file.
	const propsPath = join(workingDirectory, 'Directory.Build.props');
	writeFileSync(propsPath, readFileSync(propsPath, 'utf8').replace(TARGET_FRAMEWORK, `<TargetFramework>net${channel}</TargetFramework>`));

	const globalJson = JSON.parse(readFileSync(join(REPO_ROOT, 'global.json'), 'utf8'));
	globalJson.sdk = { version: sdkVersion, rollForward: 'disable', allowPrerelease: true };
	writeFileSync(join(workingDirectory, 'global.json'), JSON.stringify(globalJson, undefined, '\t'));

	const output = toEditorConfigFiles(validationCase.config, catalog, { commentStyle: 'titleAndLink' });
	const problems = output.skippedKeys.map(skipped => `${skipped.scopePath || '(root)'}: ${skipped.key} was left out (${skipped.reason}).`);
	for (const file of output.files) {
		const path = join(workingDirectory, file.path);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, file.content);
		problems.push(...checkEditorConfigKeys(file.content, catalog).map(problem => `${file.path}:${problem.lineNumber}: ${problem.message}`));
	}

	runDotnet(workingDirectory, ['build', SOLUTION, '-p:TreatWarningsAsErrors=false', `-flp:logfile=${BUILD_LOG};verbosity=normal`]);
	const buildLog = readFileSync(join(workingDirectory, BUILD_LOG), 'utf8');
	problems.push(...new Set(buildLog.matchAll(CONFIG_BREAKAGE).map(match => match[0].trim())));

	const projectCount = readFileSync(join(workingDirectory, SOLUTION), 'utf8').match(/\.csproj" \/>/g)?.length ?? 0;
	const compilerRunCount = buildLog.match(COMPILER_RUN)?.length ?? 0;
	if (compilerRunCount !== projectCount) problems.push(`The compiler ran for ${compilerRunCount} of ${projectCount} projects; see ${join(workingDirectory, BUILD_LOG)}.`);

	runDotnet(workingDirectory, ['format', 'whitespace', SOLUTION]);
	const verify = runDotnet(workingDirectory, ['format', 'whitespace', SOLUTION, '--verify-no-changes']);
	if (verify.status !== 0) problems.push(`A second dotnet format whitespace run still changed files:\n${verify.stdout}${verify.stderr}`);

	return problems;
}

function runDotnet(workingDirectory: string, args: string[]) {
	return spawnSync(DOTNET, args, { cwd: workingDirectory, encoding: 'utf8', env: { ...process.env, DOTNET_ROOT: DOTNET_DIRECTORY, DOTNET_MULTILEVEL_LOOKUP: '0' } });
}
