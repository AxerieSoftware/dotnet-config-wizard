import { BUILD_PROPERTIES_BY_NAME } from '../build/buildProperties.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { toFileName } from '../export/fileTree.ts';
import { FORMATTING_KEY_NAMES } from '../import/editorConfigImport.ts';
import { CI_CONDITION } from '../import/msbuildImport.ts';
import { parseJson } from '../import/repoSettingsImport.ts';

// The marker that heads the kept block. It's recognized on the next save, so the block is rebuilt rather than copied.
const KEPT_TITLE = 'Kept from the existing file';
const KEPT_NOTE = "The wizard doesn't manage these settings, so it leaves them as they were.";

const EDITORCONFIG_SETTING = /^\s*([\w.-]+)\s*=/;
const SECTION = /^\s*\[.+\]\s*$/;
const RULE_SEVERITY = /^dotnet_diagnostic\.(\w+)\.severity$/;
const MANAGED_EDITORCONFIG_KEY = /^(?:root|is_global|global_level|dotnet_analyzer_diagnostic\.(?:category-\w+\.)?severity|dotnet_naming_(?:rule|symbols|style)\.\w+\.\w+)$/;
const ANALYZER_FILE = /(?:BannedSymbols\.txt|SonarLint\.xml|PublicAPI\.(?:Shipped|Unshipped)\.txt|Analyzers\.globalconfig)/;
const MANAGED_NUGET_SECTIONS = new Set(['packageSources', 'packageSourceMapping', 'auditSources']);
const BANNED_SYMBOL = /^[TMPFEN]:/;

/** A top-level XML element or comment, as written in the file. */
type XmlNode = { raw: string; name: string; attributes: string; body: string; isComment: boolean };

/**
 * The text to save for a generated file: the wizard's version, with everything the existing file holds that the wizard
 * doesn't manage kept in a marked block at the end, so loading a repo and editing it never loses a setting.
 */
export function toSavedText(path: string, generated: string, existing: string | undefined, catalog: Catalog): string {
	if (existing === undefined) return generated;

	const fileName = toFileName(path);
	if (fileName === '.editorconfig' || fileName.endsWith('.globalconfig')) return mergeEditorConfig(generated, existing, catalog);
	if (fileName.endsWith('.props')) return mergeXml(generated, existing, 'Project', node => keepMsBuildNode(node, catalog));
	if (fileName === 'nuget.config') return mergeXml(generated, existing, 'configuration', node => (MANAGED_NUGET_SECTIONS.has(node.name) ? undefined : node.raw));
	if (fileName === 'SonarLint.xml') return mergeXml(generated, existing, 'AnalysisInput', node => (node.name === 'Rules' ? undefined : node.raw));
	if (fileName === 'global.json') return mergeGlobalJson(generated, existing);
	if (fileName === '.gitattributes') {
		const generatedLines = new Set(generated.split('\n'));
		return mergeLines(generated, existing, '#', line => !generatedLines.has(line));
	}

	if (fileName === 'BannedSymbols.txt') return mergeLines(generated, existing, '//', line => !BANNED_SYMBOL.test(line));
	return generated;
}

/** Short names for what a file holds that the wizard doesn't manage, for the notes shown after loading a repo. */
export function findUnmanaged(path: string, text: string, catalog: Catalog): string[] {
	const fileName = toFileName(path);
	if (fileName === '.editorconfig' || fileName.endsWith('.globalconfig')) {
		return text
			.split('\n')
			.map(line => EDITORCONFIG_SETTING.exec(line)?.[1])
			.filter((key): key is string => key !== undefined && !isManagedEditorConfigKey(key, catalog));
	}

	if (fileName.endsWith('.props')) {
		return toXmlNodes(innerXml(text, 'Project') ?? '')
			.filter(node => !node.isComment)
			.flatMap(node => {
				const kept = keepMsBuildNode(node, catalog);
				if (kept === undefined) return [];
				if (node.name !== 'PropertyGroup' && node.name !== 'ItemGroup') return [node.name];
				return toXmlNodes(node.body)
					.filter(child => !child.isComment && kept.includes(child.raw))
					.map(child => child.name);
			});
	}

	return [];
}

function isManagedEditorConfigKey(key: string, catalog: Catalog): boolean {
	const ruleId = RULE_SEVERITY.exec(key)?.[1];
	if (ruleId) return catalog.rules.has(ruleId);
	return MANAGED_EDITORCONFIG_KEY.test(key) || catalog.options.has(key) || FORMATTING_KEY_NAMES.has(key);
}

/** Keeps unmanaged settings with their section and the comments directly above them. */
function mergeEditorConfig(generated: string, existing: string, catalog: Catalog): string {
	const keptBySection = new Map<string, string[]>();
	// A key the generated file already writes in the same section is the wizard's, whatever the catalog says.
	const generatedKeys = toSectionKeys(generated);
	let section = '';
	let comments: string[] = [];

	for (const line of existing.split('\n')) {
		const text = line.trim();
		if (text.startsWith('#') || text.startsWith(';')) {
			if (!text.includes(KEPT_TITLE) && !text.includes(KEPT_NOTE)) comments.push(line);
			continue;
		}

		if (SECTION.test(text)) section = text;
		const key = EDITORCONFIG_SETTING.exec(line)?.[1];
		if (key && !isManagedEditorConfigKey(key, catalog) && !generatedKeys.has(`${section} ${key}`)) {
			if (!keptBySection.has(section)) keptBySection.set(section, []);
			keptBySection.get(section)?.push(...comments, line);
		}
		comments = [];
	}

	if (keptBySection.size === 0) return generated;

	// Settings above the first section apply to the file itself, so they stay above every section.
	const preamble = keptBySection.get('') ?? [];
	keptBySection.delete('');
	const lines = generated.replace(/\n+$/, '').split('\n');
	const firstSection = lines.findIndex(line => SECTION.test(line));
	if (preamble.length > 0) lines.splice(firstSection === -1 ? lines.length : firstSection, 0, ...preamble, '');

	const sections = [...keptBySection].flatMap(([header, kept]) => ['', header, ...kept]);
	return [...lines, ...(sections.length > 0 ? ['', `#### ${KEPT_TITLE} ####`, `# ${KEPT_NOTE}`, ...sections] : []), ''].join('\n');
}

function toSectionKeys(text: string): Set<string> {
	const keys = new Set<string>();
	let section = '';
	for (const line of text.split('\n')) {
		if (SECTION.test(line)) section = line.trim();
		const key = EDITORCONFIG_SETTING.exec(line)?.[1];
		if (key) keys.add(`${section} ${key}`);
	}

	return keys;
}

/**
 * Keeps the top-level elements of an XML file the wizard doesn't manage, as written, together with the comments directly
 * above them. `keep` returns the text to keep for an element, or undefined when the wizard writes it.
 */
function mergeXml(generated: string, existing: string, root: string, keep: (node: XmlNode) => string | undefined): string {
	const body = innerXml(existing, root);
	if (body === undefined) return generated;

	const kept: string[] = [];
	let comments: string[] = [];
	for (const node of toXmlNodes(body)) {
		if (node.isComment) {
			if (!node.raw.includes(KEPT_TITLE)) comments.push(node.raw);
			continue;
		}

		const text = keep(node);
		if (text !== undefined) kept.push(...comments, text);
		comments = [];
	}

	const closing = generated.lastIndexOf(`</${root}>`);
	if (kept.length === 0 || closing === -1) return generated;

	const block = [`\t<!-- ${KEPT_TITLE}: ${KEPT_NOTE} -->`, ...kept.map(text => `\t${text}`)].join('\n');
	return `${generated.slice(0, closing).replace(/\n*$/, '\n\n')}${block}\n${generated.slice(closing)}`;
}

/** What to keep of a top-level MSBuild element: everything but the properties, packages and files the wizard writes. */
function keepMsBuildNode(node: XmlNode, catalog: Catalog): string | undefined {
	const condition = /Condition="([^"]*)"/.exec(node.attributes)?.[1];
	if (node.name === 'Import') return node.attributes.includes('GetPathOfFileAbove') ? undefined : node.raw;
	if ((node.name !== 'PropertyGroup' && node.name !== 'ItemGroup') || (condition && !CI_CONDITION.test(condition))) return node.raw;

	const isManaged =
		node.name === 'PropertyGroup' ? (child: XmlNode) => BUILD_PROPERTIES_BY_NAME.has(child.name) || child.name === 'ContinuousIntegrationBuild' : (child: XmlNode) => isManagedItem(child, catalog);
	const kept: string[] = [];
	let comments: string[] = [];
	for (const child of toXmlNodes(node.body)) {
		if (child.isComment) {
			comments.push(child.raw);
			continue;
		}

		if (!isManaged(child)) kept.push(...comments, child.raw);
		comments = [];
	}

	if (kept.length === 0) return undefined;
	const attributes = node.attributes.replace(/\s*Label="[^"]*"/, '');
	return `<${node.name} Label="${KEPT_TITLE}"${attributes}>\n${kept.map(text => `\t\t${text}`).join('\n')}\n\t</${node.name}>`;
}

function isManagedItem(item: XmlNode, catalog: Catalog): boolean {
	const include = /(?:Include|Remove)="([^"]+)"/.exec(item.attributes)?.[1] ?? '';
	if (item.name === 'GlobalPackageReference' || item.name === 'PackageReference') return catalog.packages.has(include);
	if (item.name === 'AdditionalFiles' || item.name === 'GlobalAnalyzerConfigFiles') return ANALYZER_FILE.test(include);
	// The README and icon pack items the wizard writes for PackageReadmeFile and PackageIcon.
	return item.name === 'None' && include.startsWith('$(MSBuildThisFileDirectory)') && item.attributes.includes('Pack="true"');
}

/** Keeps every `global.json` key the wizard doesn't write, such as `sdk.paths` or `tools`. */
function mergeGlobalJson(generated: string, existing: string): string {
	// An existing file that isn't valid JSON has nothing to keep.
	const original = parseJson(existing) as Record<string, unknown> | undefined;
	if (!original) return generated;

	const merged = JSON.parse(generated) as Record<string, Record<string, unknown>>;
	const { sdk, test, 'msbuild-sdks': _msbuildSdks, ...rest } = original as { sdk?: Record<string, unknown>; test?: Record<string, unknown>; 'msbuild-sdks'?: unknown };
	const { version: _version, rollForward: _rollForward, allowPrerelease: _allowPrerelease, ...sdkRest } = sdk ?? {};
	const { runner: _runner, ...testRest } = test ?? {};
	merged.sdk = { ...merged.sdk, ...sdkRest };
	if (Object.keys(testRest).length > 0) merged.test = { ...merged.test, ...testRest };
	return `${JSON.stringify({ ...merged, ...rest }, undefined, '\t')}\n`;
}

/** Keeps the lines `isKept` picks, with their comments, at the end of a line-based file. */
function mergeLines(generated: string, existing: string, commentPrefix: string, isKept: (line: string) => boolean): string {
	const kept: string[] = [];
	let comments: string[] = [];
	for (const line of existing.split('\n')) {
		const text = line.trim();
		if (text === '') {
			comments = [];
		} else if (text.startsWith(commentPrefix)) {
			if (!text.includes(KEPT_TITLE)) comments.push(line);
		} else {
			if (isKept(line)) kept.push(...comments, line);
			comments = [];
		}
	}

	return kept.length === 0 ? generated : `${generated.replace(/\n*$/, '\n')}\n${commentPrefix} ${KEPT_TITLE}\n${kept.join('\n')}\n`;
}

function innerXml(text: string, root: string): string | undefined {
	return new RegExp(`<${root}(?:\\s[^>]*)?>([\\s\\S]*)</${root}>`).exec(text)?.[1];
}

/** Splits XML into its top-level elements and comments, tracking nesting so child elements stay inside their parent. */
function toXmlNodes(xml: string): XmlNode[] {
	const nodes: XmlNode[] = [];
	const tag = /<!--[\s\S]*?-->|<(\/?)([\w.:-]+)([^>]*?)(\/?)>/g;
	let depth = 0;
	let start = 0;
	let open: { name: string; attributes: string; bodyStart: number } | undefined;

	for (const match of xml.matchAll(tag)) {
		const [raw, closing, name, attributes, selfClosing] = match;
		const index = match.index ?? 0;
		if (raw.startsWith('<!--')) {
			if (depth === 0) nodes.push({ raw, name: '', attributes: '', body: '', isComment: true });
			continue;
		}

		if (closing) {
			depth--;
			if (depth === 0 && open) nodes.push({ raw: xml.slice(start, index + raw.length), name: open.name, attributes: open.attributes, body: xml.slice(open.bodyStart, index), isComment: false });
			continue;
		}

		if (depth === 0) {
			start = index;
			if (selfClosing) {
				nodes.push({ raw, name, attributes, body: '', isComment: false });
				continue;
			}

			open = { name, attributes, bodyStart: index + raw.length };
		}

		if (!selfClosing) depth++;
	}

	return nodes;
}
