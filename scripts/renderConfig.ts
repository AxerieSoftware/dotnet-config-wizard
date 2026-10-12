import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseWizardConfig } from '../src/lib/config/wizardConfig.ts';
import { toRootEditorConfig } from '../src/lib/export/rootEditorConfig.ts';
import { readCatalog } from './readCatalog.ts';

// Renders a wizard config's files. With --check it compares them to the files on disk instead of writing,
// which CI uses to keep this repo's own config in sync with config/dogfood.json.
const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string', default: '.' }, check: { type: 'boolean', default: false } } });
if (positionals.length !== 1) {
	console.error('Usage: node scripts/renderConfig.ts <config.json> [--out <folder>] [--check]');
	process.exit(1);
}

const parseResult = parseWizardConfig(JSON.parse(readFileSync(positionals[0], 'utf8')));
if (parseResult.status === 'invalid') {
	console.error(`${positionals[0]} isn't a valid wizard config: ${parseResult.reason}`);
	process.exit(1);
}

const config = parseResult.config;
const file = toRootEditorConfig(config, readCatalog(config.versions.sdkBand), { commentStyle: 'idAndTitle' });
if (file.skippedKeys.length > 0) {
	console.error(`The catalog doesn't know these keys, so they were left out: ${file.skippedKeys.join(', ')}.`);
	process.exit(1);
}

const path = join(values.out, file.path);
if (!values.check) {
	writeFileSync(path, file.content);
	console.log(`Wrote ${path}.`);
	process.exit(0);
}

if (readFileSync(path, 'utf8') !== file.content) {
	console.error(`${path} doesn't match ${positionals[0]}. Run: node scripts/renderConfig.ts ${positionals[0]} --out ${values.out}`);
	process.exit(1);
}

console.log(`${path} matches ${positionals[0]}.`);
