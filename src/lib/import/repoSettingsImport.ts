import type { BannedApi } from '../analyzers/bannedApis.ts';
import { type GlobalJsonConfig, type NuGetConfig, type NuGetSource, ROLL_FORWARD_POLICIES } from '../config/wizardConfig.ts';

const TESTING_PLATFORM_RUNNER = 'Microsoft.Testing.Platform';
const SOURCE = /<add\s+key="(?<key>[^"]+)"\s+value="(?<url>[^"]+)"/g;
const SOURCE_MAPPING = /<packageSource\s+key="(?<key>[^"]+)"\s*>(?<body>[\s\S]*?)<\/packageSource>/g;
const PATTERN = /<package\s+pattern="(?<pattern>[^"]+)"/g;
const BANNED_SYMBOL = /^(?<symbol>[TMPFEN]:[^;]+)(?:;(?<message>.*))?$/;
const SONAR_RULE = /<Rule>\s*<Key>(?<rule>[^<]+)<\/Key>\s*<Parameters>(?<body>[\s\S]*?)<\/Parameters>\s*<\/Rule>/g;
const SONAR_PARAMETER = /<Parameter>\s*<Key>(?<key>[^<]+)<\/Key>\s*<Value>(?<value>[^<]*)<\/Value>\s*<\/Parameter>/g;

/** Reads `global.json`: the pinned SDK version, and the settings the SDK step offers. */
export function importGlobalJson(text: string): { sdkVersion?: string; globalJson: GlobalJsonConfig } | undefined {
	const json = parseJson(text) as { sdk?: { version?: unknown; rollForward?: unknown }; 'msbuild-sdks'?: unknown; test?: { runner?: unknown } } | undefined;
	if (!json) return undefined;

	const rollForward = ROLL_FORWARD_POLICIES.find(policy => policy === json.sdk?.rollForward) ?? 'latestFeature';
	const msbuildSdks = Object.fromEntries(Object.entries((json['msbuild-sdks'] ?? {}) as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
	return {
		...(typeof json.sdk?.version === 'string' ? { sdkVersion: json.sdk.version } : {}),
		globalJson: { rollForward, isTestingPlatformRunner: json.test?.runner === TESTING_PLATFORM_RUNNER, msbuildSdks }
	};
}

/** Reads `nuget.config`'s package sources, their package patterns and the audit source. */
export function importNuGetConfig(text: string): NuGetConfig | undefined {
	const packageSources = findSection(text, 'packageSources');
	if (packageSources === undefined) return undefined;

	const patternsByKey = new Map(
		[...(findSection(text, 'packageSourceMapping')?.matchAll(SOURCE_MAPPING) ?? [])].map(match => [
			match.groups?.key ?? '',
			[...(match.groups?.body ?? '').matchAll(PATTERN)].map(pattern => pattern.groups?.pattern ?? '')
		])
	);
	const sources: NuGetSource[] = [...packageSources.matchAll(SOURCE)].map(match => ({
		key: match.groups?.key ?? '',
		url: match.groups?.url ?? '',
		patterns: patternsByKey.get(match.groups?.key ?? '') ?? []
	}));
	const auditSourceUrl = [...(findSection(text, 'auditSources') ?? '').matchAll(SOURCE)][0]?.groups?.url ?? sources[0]?.url ?? '';
	return { sources, auditSourceUrl };
}

/** Reads `BannedSymbols.txt`: one documentation ID per line, with an optional message after a semicolon. */
export function importBannedSymbols(text: string): BannedApi[] {
	return text
		.split('\n')
		.map(line => BANNED_SYMBOL.exec(line.trim())?.groups)
		.filter(groups => groups !== undefined)
		.map(groups => ({ symbol: groups.symbol, message: (groups.message ?? '').trim() }));
}

/** Reads the rule parameters from Sonar's `SonarLint.xml`. */
export function importSonarLintXml(text: string): Record<string, Record<string, string>> {
	return Object.fromEntries(
		[...text.matchAll(SONAR_RULE)].map(rule => [
			rule.groups?.rule.trim() ?? '',
			Object.fromEntries([...(rule.groups?.body ?? '').matchAll(SONAR_PARAMETER)].map(parameter => [parameter.groups?.key.trim() ?? '', parameter.groups?.value ?? '']))
		])
	);
}

/** Parses JSON, or returns undefined for text that isn't valid JSON. */
export function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		// Text that isn't valid JSON reads as missing; the repo's own file is left as it is.
		return undefined;
	}
}

function findSection(text: string, name: string): string | undefined {
	return new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text)?.[1];
}
