import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseWizardConfig, type WizardConfig } from '../src/lib/config/wizardConfig.ts';
import { checkEditorConfigKeys } from '../src/lib/export/checkEditorConfigKeys.ts';
import { toExhaustiveConfig } from '../src/lib/export/exhaustiveConfig.ts';
import { toRootEditorConfig } from '../src/lib/export/rootEditorConfig.ts';
import { readCatalog } from './readCatalog.ts';

// Renders each config into a copy of validation/, builds it and checks only for config breakage. Code diagnostics
// in the sample code are expected, and the build exit code is ignored because `severity = error` fails projects.
const REPO_ROOT = join(import.meta.dirname, '..');
const SOLUTION = 'Validation.slnx';
const BUILD_LOG = 'build.log';
const CONFIG_BREAKAGE = /\b(?:warning|error) (?<code>AD0001|CS8032|MSB\d{4}|NU1\d{3})\b.*$/gm;

type ValidationCase = { name: string; config: WizardConfig };

const dogfoodResult = parseWizardConfig(JSON.parse(readFileSync(join(REPO_ROOT, 'config', 'dogfood.json'), 'utf8')));
if (dogfoodResult.status === 'invalid') throw new Error(`config/dogfood.json isn't a valid wizard config: ${dogfoodResult.reason}`);

const catalog = readCatalog(dogfoodResult.config.versions.sdkBand);
const cases: ValidationCase[] = [
	{ name: 'dogfood', config: dogfoodResult.config },
	{ name: 'exhaustive', config: toExhaustiveConfig(catalog) }
];

let failureCount = 0;
for (const validationCase of cases) {
	const problems = validate(validationCase);
	failureCount += problems.length;
	console.log(problems.length === 0 ? `✓ ${validationCase.name}` : `✗ ${validationCase.name}\n${problems.map(problem => `  ${problem}`).join('\n')}`);
}

process.exit(failureCount === 0 ? 0 : 1);

function validate(validationCase: ValidationCase): string[] {
	const workingDirectory = mkdtempSync(join(tmpdir(), `validate-${validationCase.name}-`));
	cpSync(join(REPO_ROOT, 'validation'), workingDirectory, { recursive: true });
	cpSync(join(REPO_ROOT, 'global.json'), join(workingDirectory, 'global.json'));

	const file = toRootEditorConfig(validationCase.config, catalog, { commentStyle: 'titleAndLink' });
	writeFileSync(join(workingDirectory, file.path), file.content);

	const problems = [
		...file.skippedKeys.map(key => `The catalog doesn't know ${key}, so it was left out.`),
		...checkEditorConfigKeys(file.content, catalog).map(problem => `${file.path}:${problem.lineNumber}: ${problem.message}`)
	];

	runDotnet(workingDirectory, ['build', SOLUTION, '-p:TreatWarningsAsErrors=false', `-flp:logfile=${BUILD_LOG};verbosity=normal`]);
	const buildLog = readFileSync(join(workingDirectory, BUILD_LOG), 'utf8');
	const breakages = new Set(buildLog.matchAll(CONFIG_BREAKAGE).map(match => match[0].trim()));
	problems.push(...breakages);

	runDotnet(workingDirectory, ['format', 'whitespace', SOLUTION]);
	const verify = runDotnet(workingDirectory, ['format', 'whitespace', SOLUTION, '--verify-no-changes']);
	if (verify.status !== 0) problems.push(`A second dotnet format whitespace run still changed files:\n${verify.stdout}${verify.stderr}`);

	return problems;
}

function runDotnet(workingDirectory: string, args: string[]) {
	return spawnSync('dotnet', args, { cwd: workingDirectory, encoding: 'utf8' });
}
