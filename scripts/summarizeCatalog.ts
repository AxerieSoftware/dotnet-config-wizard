import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BandEntry, PackageCatalogFile, PackageEntry, SdkCatalogFile } from '../src/lib/catalog/catalogFiles.ts';

// Compares catalog/generated with the last commit and prints a Markdown summary for the refresh pull request: new and
// removed rules by source, band and package version changes, and packages that fail the maintenance gate.
const REPO_ROOT = join(import.meta.dirname, '..');
const GENERATED_PATH = 'catalog/generated';

type RuleSummary = { id: string; source: string; title: string };

const committedFileNames = git(['ls-tree', '--name-only', 'HEAD', `${GENERATED_PATH}/`])
	.split('\n')
	.filter(path => path !== '')
	.map(path => path.slice(GENERATED_PATH.length + 1));
const currentFileNames = readdirSync(join(REPO_ROOT, GENERATED_PATH));

const readCommitted = <TValue>(fileName: string): TValue | undefined =>
	committedFileNames.includes(fileName) ? (JSON.parse(git(['show', `HEAD:${GENERATED_PATH}/${fileName}`])) as TValue) : undefined;
const readCurrent = <TValue>(fileName: string): TValue | undefined =>
	currentFileNames.includes(fileName) ? (JSON.parse(readFileSync(join(REPO_ROOT, GENERATED_PATH, fileName), 'utf8')) as TValue) : undefined;

const sections = [
	toBandSection(readCommitted<BandEntry[]>('bands.json') ?? [], readCurrent<BandEntry[]>('bands.json') ?? []),
	toRuleSection(toRules(committedFileNames, readCommitted), toRules(currentFileNames, readCurrent)),
	toPackageSection(readCommitted<PackageEntry[]>('packages.json') ?? [], readCurrent<PackageEntry[]>('packages.json') ?? [])
].filter(section => section !== '');

console.log(sections.length === 0 ? 'Only dates and docs text changed.' : sections.join('\n\n'));

/** Every rule across the SDK bands and packages, keyed by ID; a rule in several bands is counted once. */
function toRules(fileNames: readonly string[], read: <TValue>(fileName: string) => TValue | undefined): Map<string, RuleSummary> {
	const rules = new Map<string, RuleSummary>();
	for (const fileName of fileNames.filter(name => name.startsWith('sdk-') || name.startsWith('package-'))) {
		const catalogFile = read<SdkCatalogFile | PackageCatalogFile>(fileName);
		for (const rule of catalogFile?.rules ?? []) rules.set(rule.id, { id: rule.id, source: rule.source, title: rule.title });
	}

	return rules;
}

function toBandSection(committed: readonly BandEntry[], current: readonly BandEntry[]): string {
	const lines = [
		...current.filter(band => !committed.some(old => old.band === band.band)).map(band => `- Added SDK ${band.band} (${band.sdkVersion}${band.isPreview ? ', preview' : ''}).`),
		...committed.filter(band => !current.some(entry => entry.band === band.band)).map(band => `- Removed SDK ${band.band}. Update config/dogfood.json and tests that name it.`),
		...current.flatMap(band => {
			const old = committed.find(entry => entry.band === band.band);
			return old && old.sdkVersion !== band.sdkVersion ? [`- SDK ${band.band}: ${old.sdkVersion} → ${band.sdkVersion}.`] : [];
		})
	];
	return lines.length === 0 ? '' : `## SDK bands\n\n${lines.join('\n')}`;
}

function toRuleSection(committed: ReadonlyMap<string, RuleSummary>, current: ReadonlyMap<string, RuleSummary>): string {
	const added = [...current.values()].filter(rule => !committed.has(rule.id));
	const removed = [...committed.values()].filter(rule => !current.has(rule.id));
	if (added.length === 0 && removed.length === 0) return '';

	const parts = ['## Rules'];
	if (added.length > 0) parts.push(`### New\n\n${toRuleLines(added)}`);
	// A drop usually means a package's layout changed and its analyzers no longer load, so it gets a closer look.
	if (removed.length > 0) parts.push(`### Removed: check these weren't lost to a loading problem\n\n${toRuleLines(removed)}`);
	return parts.join('\n\n');
}

function toRuleLines(rules: readonly RuleSummary[]): string {
	return Map.groupBy(rules, rule => rule.source)
		.entries()
		.map(([source, sourceRules]) => `- **${source}**: ${sourceRules.map(rule => `${rule.id} ${rule.title}`).join('; ')}`)
		.toArray()
		.join('\n');
}

function toPackageSection(committed: readonly PackageEntry[], current: readonly PackageEntry[]): string {
	const lines = current.flatMap(entry => {
		const old = committed.find(oldEntry => oldEntry.id === entry.id);
		const changes = [];
		if (!old) changes.push(`- Added ${entry.id} ${entry.version}.`);
		else if (old.version !== entry.version) changes.push(`- ${entry.id}: ${old.version} → ${entry.version}.`);
		if (entry.isStale) changes.push(`- **${entry.id} fails the maintenance gate**: no release since ${entry.latestPublished}. Consider dropping it from catalog/packages.json.`);
		if (entry.isDeprecated) changes.push(`- **${entry.id} fails the maintenance gate**: deprecated on NuGet.`);
		return changes;
	});
	return lines.length === 0 ? '' : `## Packages\n\n${lines.join('\n')}`;
}

function git(args: string[]): string {
	const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
	if (result.status !== 0) throw new Error(`git ${args.join(' ')} exited with ${result.status}: ${result.stderr}`);
	return result.stdout;
}
