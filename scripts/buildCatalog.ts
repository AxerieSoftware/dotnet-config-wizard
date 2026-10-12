import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOTNET_DIRECTORY, ensureSdksInstalled } from './dotnetSdks.ts';

// Regenerates catalog/generated from the latest SDK of every supported .NET 10 or later channel and a sparse clone of dotnet/docs.
const REPO_ROOT = join(import.meta.dirname, '..');
const CACHE_DIRECTORY = join(REPO_ROOT, '.cache');
const DOCS_DIRECTORY = join(CACHE_DIRECTORY, 'dotnet-docs');
const OUTPUT_DIRECTORY = join(REPO_ROOT, 'catalog', 'generated');
const RELEASES_INDEX_URL = 'https://builds.dotnet.microsoft.com/dotnet/release-metadata/releases-index.json';
const UNSUPPORTED_PHASE = 'eol';
// The wizard targets SDK 10 and later only.
const MINIMUM_CHANNEL_MAJOR = 10;

type ReleasesIndex = { 'releases-index': { 'channel-version': string; 'latest-sdk': string; 'support-phase': string }[] };

mkdirSync(CACHE_DIRECTORY, { recursive: true });

const releasesIndexText = await fetchText(RELEASES_INDEX_URL);
const releasesIndexPath = join(CACHE_DIRECTORY, 'releases-index.json');
writeFileSync(releasesIndexPath, releasesIndexText);

const sdkVersions = (JSON.parse(releasesIndexText) as ReleasesIndex)['releases-index']
	.filter(channel => channel['support-phase'] !== UNSUPPORTED_PHASE && Number.parseInt(channel['channel-version'], 10) >= MINIMUM_CHANNEL_MAJOR)
	.map(channel => channel['latest-sdk']);

await ensureSdksInstalled(sdkVersions);

if (existsSync(join(DOCS_DIRECTORY, '.git'))) {
	run('git', ['-C', DOCS_DIRECTORY, 'pull', '--quiet', '--depth', '1']);
} else {
	run('git', ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--sparse', 'https://github.com/dotnet/docs.git', DOCS_DIRECTORY]);
	run('git', ['-C', DOCS_DIRECTORY, 'sparse-checkout', 'set', 'docs/fundamentals/code-analysis/style-rules']);
}

// Bands that drop out of support would otherwise linger as stale files.
for (const fileName of readdirSync(OUTPUT_DIRECTORY).filter(name => name.startsWith('sdk-'))) rmSync(join(OUTPUT_DIRECTORY, fileName));

const sdkArguments = sdkVersions.flatMap(sdkVersion => ['--sdk', join(DOTNET_DIRECTORY, 'sdk', sdkVersion)]);
run('dotnet', ['run', '--project', join(REPO_ROOT, 'tools', 'CatalogBuilder'), '--', ...sdkArguments, '--docs', DOCS_DIRECTORY, '--releases-index', releasesIndexPath, '--out', OUTPUT_DIRECTORY]);

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`GET ${url} returned ${response.status}.`);
	return response.text();
}

function run(command: string, args: string[]): void {
	const result = spawnSync(command, args, { cwd: REPO_ROOT, stdio: 'inherit' });
	if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status}.`);
}
