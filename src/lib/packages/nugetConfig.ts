import { escapeXml } from '../build/msbuildXml.ts';
import type { NuGetConfig } from '../config/wizardConfig.ts';

export const NUGET_ORG = { key: 'nuget.org', url: 'https://api.nuget.org/v3/index.json' } as const;

/** nuget.org's vulnerability-only index, for organizations that block api.nuget.org but still want NuGet audit. */
export const NUGET_ORG_AUDIT_ONLY_URL = 'https://data.nuget.org/v3/index.json';

/**
 * Renders `nuget.config`. It clears sources inherited from machine and user config so restores are the same everywhere,
 * maps every package to exactly one source, which blocks dependency confusion, and names the audit source explicitly.
 * Signature validation is left as a commented-out option: requiring it breaks unsigned packages from private feeds.
 */
export function toNuGetConfig(config: NuGetConfig): string {
	const sources = config.sources.map(source => `\t\t<add key="${escapeXml(source.key)}" value="${escapeXml(source.url)}" protocolVersion="3" />`);
	const mappings = config.sources.flatMap(source => [
		`\t\t<packageSource key="${escapeXml(source.key)}">`,
		...source.patterns.map(pattern => `\t\t\t<package pattern="${escapeXml(pattern)}" />`),
		'\t\t</packageSource>'
	]);

	return [
		'<?xml version="1.0" encoding="utf-8"?>',
		'<configuration>',
		'\t<packageSources>',
		'\t\t<clear />',
		...sources,
		'\t</packageSources>',
		'\t<packageSourceMapping>',
		...mappings,
		'\t</packageSourceMapping>',
		'\t<auditSources>',
		'\t\t<clear />',
		`\t\t<add key="audit" value="${escapeXml(config.auditSourceUrl)}" />`,
		'\t</auditSources>',
		'\t<!-- Uncomment to accept only signed packages. Unsigned packages from private feeds then fail to restore. -->',
		'\t<!--',
		'\t<config>',
		'\t\t<add key="signatureValidationMode" value="require" />',
		'\t</config>',
		'\t-->',
		'</configuration>',
		''
	].join('\n');
}
