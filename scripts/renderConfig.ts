import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { toPresetName } from '../src/lib/config/presets.ts';
import { findRepoConfigProblem, isRepoConfig, type RepoConfig, toRepoWizardConfig } from '../src/lib/config/repoConfig.ts';
import { parseWizardConfig, type WizardConfig } from '../src/lib/config/wizardConfig.ts';
import { toGeneratedOutput } from '../src/lib/export/generatedOutput.ts';
import { readCatalog } from './readCatalog.ts';

// Renders a wizard config's files, or a repo config's: a preset, what each folder holds and the repo's changes. With
// --check it compares them to the files on disk instead of writing, which CI uses to keep this repo's own config in sync
// with config/dogfood.json.
const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string', default: '.' }, check: { type: 'boolean', default: false } } });
if (positionals.length !== 1) {
	console.error('Usage: node scripts/renderConfig.ts <config.json> [--out <folder>] [--check]');
	process.exit(1);
}

const { config, presetName } = readConfig(positionals[0]);
const { files, skippedKeys } = toGeneratedOutput(config, readCatalog(config.versions.sdkBand), { commentStyle: 'idAndTitle', presetName });
if (skippedKeys.length > 0) {
	console.error(`These keys were left out:\n${skippedKeys.map(skipped => `${skipped.scopePath || '(root)'}: ${skipped.key} (${skipped.reason})`).join('\n')}`);
	process.exit(1);
}

let mismatchCount = 0;
for (const file of files) {
	const path = join(values.out, file.path);
	if (!values.check) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, file.content);
		console.log(`Wrote ${path}.`);
	} else if (readFileOrEmpty(path) !== file.content) {
		console.error(`${path} doesn't match ${positionals[0]}.`);
		mismatchCount++;
	}
}

if (mismatchCount > 0) {
	console.error(`Run: node scripts/renderConfig.ts ${positionals[0]} --out ${values.out}`);
	process.exit(1);
}

if (values.check) console.log(`Every file matches ${positionals[0]}.`);

/** Reads a full wizard config, or a repo config, which names a preset and is expanded with this wizard's version of it. */
function readConfig(path: string): { config: WizardConfig; presetName?: string } {
	const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
	if (isRepoConfig(value)) {
		const problem = findRepoConfigProblem(value);
		if (problem) exitWithError(`${path} isn't a valid repo config: ${problem}`);
		const repoConfig = value as RepoConfig;
		const result = toRepoWizardConfig(repoConfig, readCatalog(repoConfig.sdkBand));
		if (result.status === 'invalid') exitWithError(`${path} isn't a valid repo config: ${result.reason}`);
		return { config: result.config, presetName: toPresetName(repoConfig.preset) };
	}

	const parseResult = parseWizardConfig(value);
	if (parseResult.status === 'invalid') exitWithError(`${path} isn't a valid wizard config: ${parseResult.reason}`);
	return { config: parseResult.config };
}

function exitWithError(message: string): never {
	console.error(message);
	process.exit(1);
}

function readFileOrEmpty(path: string): string {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		// A missing file just doesn't match.
		return '';
	}
}
