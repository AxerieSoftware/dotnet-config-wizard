import { type ConditionKind, PROJECT_UNDER_TEST_PATH, TEST_ASSEMBLY_NAME, toConditionKind } from '../build/buildProperties.ts';
import { WRITTEN_PROPERTY_NAMES } from '../build/buildPropsFiles.ts';
import type { Catalog } from '../catalog/catalog.ts';
import { HEADER_PATTERN, PROJECTS_PATTERN } from '../export/editorConfigFiles.ts';
import { toFileName } from '../export/fileTree.ts';
import { FORMATTING_KEY_NAMES } from '../import/editorConfigImport.ts';
import { parseJson } from '../import/repoSettingsImport.ts';

const EDITORCONFIG_SETTING = /^\s*([\w.-]+)\s*=/;
const SECTION = /^\s*\[.+\]\s*$/;
const MSBUILD_GROUP = /^<(?:PropertyGroup|ItemGroup)[\s>]/;
const RULE_SEVERITY = /^dotnet_diagnostic\.(\w+)\.severity$/;
const MANAGED_EDITORCONFIG_KEY = /^(?:root|is_global|global_level|dotnet_analyzer_diagnostic\.(?:category-\w+\.)?severity|dotnet_naming_(?:rule|symbols|style)\.\w+\.\w+)$/;
const ANALYZER_FILE = /(?:BannedSymbols\.txt|SonarLint\.xml|PublicAPI\.(?:Shipped|Unshipped)\.txt|Analyzers\.globalconfig)/;
const MANAGED_NUGET_SECTIONS = new Set(['packageSources', 'packageSourceMapping', 'auditSources']);
const BANNED_SYMBOL = /^[TMPFEN]:/;

/** A top-level XML element or comment, as written in the file. */
type XmlNode = { raw: string; name: string; attributes: string; body: string; isComment: boolean };

/** What saving does with an existing top-level XML element: drop it, keep it whole, or keep the children the wizard doesn't write. */
type XmlNodeHandling = { kind: 'managed' } | { kind: 'kept' } | { kind: 'group'; isManagedChild: (child: XmlNode) => boolean };

/** An element with the comments directly above it. */
type CommentedNode = { node: XmlNode; comments: string[] };

/** Lines to add after a line of the generated file; insertions at the same line keep the order they were found in. */
type Insertion = { after: number; lines: string[] };

/** A top-level element of the generated XML, by line. */
type GeneratedXmlNode = { name: string; conditionKind: ConditionKind; start: number; end: number };

/**
 * How a file type writes the comment above a setting and, for files where the same setting can appear in several
 * sections, how to name the section a line starts.
 */
type CommentSyntax = { isComment: (line: string) => boolean; toSection?: (line: string) => string | undefined };

/**
 * The text to save for a generated file: the wizard's version, with everything the existing file holds that the wizard
 * doesn't manage put back beside the setting it followed, so loading a repo and editing it never loses or moves a setting.
 * A setting the file already has with the same value and no comment above it stays without one, so the wizard adds
 * comments only to what it changes, unless every comment is asked for.
 */
export function toSavedText(path: string, generated: string, existing: string | undefined, catalog: Catalog, options = { isAddingEveryComment: false }): string {
	if (existing === undefined) return generated;

	const fileName = toFileName(path);
	const merged = toMergedText(fileName, generated, existing, catalog);
	const syntax = toCommentSyntax(fileName);
	return syntax && !options.isAddingEveryComment ? withoutAddedComments(merged, existing, syntax) : merged;
}

function toMergedText(fileName: string, generated: string, existing: string, catalog: Catalog): string {
	if (fileName === '.editorconfig' || fileName.endsWith('.globalconfig')) return mergeEditorConfig(generated, existing, catalog);
	if (fileName.endsWith('.props')) return mergeXml(generated, existing, 'Project', node => toMsBuildHandling(node, catalog));
	if (fileName === 'nuget.config') return mergeXml(generated, existing, 'configuration', node => ({ kind: MANAGED_NUGET_SECTIONS.has(node.name) ? 'managed' : 'kept' }));
	if (fileName === 'SonarLint.xml') return mergeXml(generated, existing, 'AnalysisInput', node => ({ kind: node.name === 'Rules' ? 'managed' : 'kept' }));
	if (fileName === 'global.json') return mergeGlobalJson(generated, existing);
	if (fileName === '.gitattributes') return mergeLines(generated, existing, '#', () => true);

	if (fileName === 'BannedSymbols.txt') return mergeLines(generated, existing, '//', line => !BANNED_SYMBOL.test(line));
	return generated;
}

function toCommentSyntax(fileName: string): CommentSyntax | undefined {
	if (fileName === '.editorconfig' || fileName.endsWith('.globalconfig')) {
		// Only a setting's own comment can be dropped. Section, part and block headings (`##` and up) title settings the
		// file may not have yet, and the header records what repo import reads back.
		return {
			isComment: line => (line.startsWith('#') || line.startsWith(';')) && !line.startsWith('##') && !HEADER_PATTERN.test(line) && !PROJECTS_PATTERN.test(line),
			toSection: line => (SECTION.test(line) ? line : undefined)
		};
	}
	if (fileName.endsWith('.props')) {
		// Moving a property into or out of the CI-only group counts as a change, so it gets its comment.
		return { isComment: isXmlComment, toSection: line => (MSBUILD_GROUP.test(line) ? toConditionKind(line) : undefined) };
	}
	if (fileName === 'nuget.config' || fileName === 'SonarLint.xml') return { isComment: isXmlComment };
	if (fileName === '.gitattributes') return { isComment: line => line.startsWith('#') };
	if (fileName === 'BannedSymbols.txt') return { isComment: line => line.startsWith('//') };
	return undefined;
}

function isXmlComment(line: string): boolean {
	return line.startsWith('<!--') && line.endsWith('-->');
}

/**
 * Leaves out the comments directly above a setting the existing file already has with the same value but no comment
 * above. Someone may have removed the wizard's comments on purpose, so saving doesn't bring them back, while a comment
 * the file has is replaced with the wizard's current one, such as after the comment style changes.
 */
function withoutAddedComments(merged: string, existing: string, syntax: CommentSyntax): string {
	const existingLines = existing.split('\n');
	const existingSectionedLines = toSectionedLines(existingLines, syntax);
	const existingSettings = new Set(existingSectionedLines);
	const commentedSettings = new Set(existingSectionedLines.filter((_, index) => index > 0 && syntax.isComment(existingLines[index - 1].trim())));
	const existingTrimmedLines = new Set(existingLines.map(line => line.trim()));
	const lines = merged.split('\n');
	const sectionedLines = toSectionedLines(lines, syntax);
	const dropped = new Set<number>();

	for (const [index, line] of lines.entries()) {
		const text = line.trim();
		const sectionedLine = sectionedLines[index];
		if (text === '' || syntax.isComment(text) || !existingSettings.has(sectionedLine) || commentedSettings.has(sectionedLine)) continue;

		for (let above = index - 1; above >= 0 && syntax.isComment(lines[above].trim()); above--) {
			if (!existingTrimmedLines.has(lines[above].trim())) dropped.add(above);
		}
	}

	return lines.filter((_, index) => !dropped.has(index)).join('\n');
}

/** Each line with the section it's in, for files where the same setting can appear in several sections. */
function toSectionedLines(lines: readonly string[], syntax: CommentSyntax): string[] {
	let section = '';
	return lines.map(line => {
		const trimmed = line.trim();
		section = syntax.toSection?.(trimmed) ?? section;
		return `${section}\n${trimmed}`;
	});
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
				const handling = toMsBuildHandling(node, catalog);
				if (handling.kind === 'managed') return [];
				if (node.name !== 'PropertyGroup' && node.name !== 'ItemGroup') return [node.name];
				return toXmlNodes(node.body)
					.filter(child => !child.isComment && (handling.kind === 'kept' || !handling.isManagedChild(child)))
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

/** Keeps unmanaged settings, with the comments directly above them, after the setting they followed in their section. */
function mergeEditorConfig(generated: string, existing: string, catalog: Catalog): string {
	const lines = generated.replace(/\n+$/, '').split('\n');
	// A key the generated file already writes in the same section is the wizard's, whatever the catalog says.
	const generatedKeys = toSectionKeys(generated);
	const insertions: Insertion[] = [];
	const missingSections = new Map<string, string[]>();
	let section = '';
	let anchorKey: string | undefined;
	let comments: string[] = [];

	for (const line of existing.split('\n')) {
		const text = line.trim();
		if (text.startsWith('#') || text.startsWith(';')) {
			comments.push(line);
			continue;
		}

		if (SECTION.test(text)) {
			section = text;
			anchorKey = undefined;
		}

		const key = EDITORCONFIG_SETTING.exec(line)?.[1];
		if (key && generatedKeys.has(`${section} ${key}`)) {
			anchorKey = key;
		} else if (key && !isManagedEditorConfigKey(key, catalog)) {
			const after = findEditorConfigAnchor(lines, section, anchorKey);
			if (after === undefined) missingSections.set(section, [...(missingSections.get(section) ?? []), ...comments, line]);
			else insertions.push({ after, lines: [...comments, line] });
		}
		comments = [];
	}

	const merged = applyInsertions(lines, insertions);
	for (const [header, kept] of missingSections) merged.push('', header, ...kept);
	return `${merged.join('\n')}\n`;
}

/** The generated line a kept setting goes after: the setting it followed, or else the top of its section. */
function findEditorConfigAnchor(lines: readonly string[], section: string, anchorKey: string | undefined): number | undefined {
	const header = section === '' ? -1 : lines.findIndex(line => line.trim() === section);
	if (header === -1 && section !== '') return undefined;

	const nextSection = lines.findIndex((line, index) => index > header && SECTION.test(line));
	const end = nextSection === -1 ? lines.length : nextSection;
	const anchor = anchorKey === undefined ? -1 : lines.findIndex((line, index) => index > header && index < end && EDITORCONFIG_SETTING.exec(line)?.[1] === anchorKey);
	if (anchor !== -1) return anchor;

	// Settings above the first section stay at the end of the preamble; in a section, one that led it stays first.
	if (section !== '') return header;
	return lines.findLastIndex((line, index) => index < end && line.trim() !== '');
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
 * Keeps the top-level XML elements the wizard doesn't manage, and the children it doesn't write in the groups it does,
 * each with the comments directly above it, after the element or child it followed.
 */
function mergeXml(generated: string, existing: string, root: string, toHandling: (node: XmlNode) => XmlNodeHandling): string {
	const body = innerXml(existing, root);
	if (body === undefined) return generated;

	const lines = generated.replace(/\n+$/, '').split('\n');
	const rootLine = lines.findIndex(line => line.trimStart().startsWith(`<${root}`));
	if (rootLine === -1) return generated;

	const indent = /^\s*/.exec(lines.slice(rootLine + 1).find(line => line.trim() !== '') ?? '')?.[0] ?? '\t';
	const generatedNodes = toGeneratedXmlNodes(lines, indent);
	const insertions: Insertion[] = [];
	let topAnchor = rootLine;

	for (const { node, comments } of toCommentedNodes(toXmlNodes(body))) {
		const handling = toHandling(node);
		if (handling.kind === 'managed') {
			const match = generatedNodes.find(generatedNode => generatedNode.name === node.name);
			if (match) topAnchor = match.end;
			continue;
		}

		const generatedGroup = handling.kind === 'group' ? mergeXmlGroup(node, handling.isManagedChild, lines, generatedNodes, indent, insertions) : undefined;
		if (generatedGroup) {
			topAnchor = generatedGroup.end;
			continue;
		}

		const kept = handling.kind === 'kept' ? node.raw : toKeptGroup(node, handling.isManagedChild, indent);
		if (kept !== undefined) insertions.push({ after: topAnchor, lines: ['', ...toIndentedLines(comments, kept, indent)] });
	}

	return `${applyInsertions(lines, insertions).join('\n')}\n`;
}

function toGeneratedXmlNodes(lines: readonly string[], indent: string): GeneratedXmlNode[] {
	const nodes: GeneratedXmlNode[] = [];
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (!line.startsWith(`${indent}<`) || line.startsWith(`${indent}</`) || line.startsWith(`${indent}<!--`) || line.startsWith(`${indent}${indent}`)) continue;

		const name = /^<([\w.:-]+)/.exec(line.trim())?.[1] ?? '';
		const closing = line.trimEnd().endsWith('/>') ? index : lines.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate === `${indent}</${name}>`);
		nodes.push({ name, conditionKind: toConditionKind(line), start: index, end: closing === -1 ? index : closing });
	}

	return nodes;
}

/** Pairs each element with the comments directly above it. Comments with no element after them are dropped. */
function toCommentedNodes(nodes: readonly XmlNode[]): CommentedNode[] {
	const result: CommentedNode[] = [];
	let comments: string[] = [];
	for (const node of nodes) {
		if (node.isComment) {
			comments.push(node.raw);
			continue;
		}

		result.push({ node, comments });
		comments = [];
	}

	return result;
}

/**
 * Puts a group's kept children into the generated group that writes its managed children, after the child each followed.
 * Returns that generated group, or undefined when the generated file writes none of them.
 */
function mergeXmlGroup(
	node: XmlNode,
	isManagedChild: (child: XmlNode) => boolean,
	lines: readonly string[],
	generatedNodes: readonly GeneratedXmlNode[],
	indent: string,
	insertions: Insertion[]
): GeneratedXmlNode | undefined {
	const children = toCommentedNodes(toXmlNodes(node.body));
	const childIndent = indent + indent;
	// Only groups with the same kind of condition, so a kept child of a CI-only group never moves into an unconditional one, and a new
	// project name prefix takes over the old prefix's group.
	const conditionKind = toConditionKind(node.attributes);
	const groups = generatedNodes.filter(generatedNode => generatedNode.name === node.name && generatedNode.conditionKind === conditionKind);
	const findGeneratedLine = (child: XmlNode) => {
		const identity = toChildIdentity(child.name, child.attributes);
		return lines.findIndex((line, index) => line.startsWith(childIndent) && toLineIdentity(line) === identity && groups.some(group => group.start < index && index < group.end));
	};

	const managedChildren = children.filter(({ node: child }) => isManagedChild(child));
	const generatedLines = new Map(managedChildren.map(({ node: child }) => [child, findGeneratedLine(child)]));
	const firstGeneratedLine = [...generatedLines.values()].find(index => index !== -1);
	if (firstGeneratedLine === undefined) return undefined;

	let anchor: number | undefined;
	for (const { node: child, comments } of children) {
		const generatedLine = generatedLines.get(child);
		if (generatedLine === undefined) {
			// A kept child before any managed one goes above the first managed child and its comments.
			insertions.push({ after: anchor ?? toLineAboveComments(lines, firstGeneratedLine), lines: toIndentedLines(comments, child.raw, childIndent) });
		} else if (generatedLine !== -1) {
			anchor = generatedLine;
		}
	}

	return groups.find(group => group.start < firstGeneratedLine && group.end > firstGeneratedLine);
}

/** A group none of whose managed children are generated: only its kept children, under its own start tag, or undefined when it keeps none. */
function toKeptGroup(node: XmlNode, isManagedChild: (child: XmlNode) => boolean, indent: string): string | undefined {
	const kept = toCommentedNodes(toXmlNodes(node.body))
		.filter(({ node: child }) => !isManagedChild(child))
		.flatMap(({ node: child, comments }) => toIndentedLines(comments, child.raw, indent + indent));
	if (kept.length === 0) return undefined;
	return [`<${node.name}${node.attributes}>`, ...kept, `${indent}</${node.name}>`].join('\n');
}

/** The line just above a generated child and the comments that describe it. */
function toLineAboveComments(lines: readonly string[], index: number): number {
	let above = index - 1;
	while (above >= 0 && lines[above].trim().startsWith('<!--')) above--;
	return above;
}

function toLineIdentity(line: string): string {
	const [node] = toXmlNodes(line.trim());
	return node ? toChildIdentity(node.name, node.attributes) : '';
}

/** A child element's name, plus what it includes or removes for items, so the same item can be found in either file. */
function toChildIdentity(name: string, attributes: string): string {
	const include = toItemInclude(attributes);
	return include === undefined ? name : `${name} ${include}`;
}

function toItemInclude(attributes: string): string | undefined {
	return /(?:Include|Remove)="([^"]*)"/.exec(attributes)?.[1];
}

/** An element's lines with the comments above it, starting at `indent`; the element's later lines keep the indentation they have. */
function toIndentedLines(comments: readonly string[], raw: string, indent: string): string[] {
	const [first, ...rest] = raw.split('\n');
	return [...comments.map(comment => indent + comment), indent + first, ...rest];
}

function applyInsertions(lines: readonly string[], insertions: readonly Insertion[]): string[] {
	const result = [...lines];
	// From the bottom up so earlier positions stay valid; same-position insertions go in reverse so they end up in order.
	const ordered = insertions.map((insertion, order) => ({ ...insertion, order })).sort((left, right) => right.after - left.after || right.order - left.order);
	for (const insertion of ordered) result.splice(insertion.after + 1, 0, ...insertion.lines);
	return result;
}

/** How saving treats a top-level MSBuild element: unconditional and CI-only groups are merged, the parent import is the wizard's, and everything else is kept. */
function toMsBuildHandling(node: XmlNode, catalog: Catalog): XmlNodeHandling {
	if (node.name === 'Import') return { kind: node.attributes.includes('GetPathOfFileAbove') ? 'managed' : 'kept' };

	const conditionKind = toConditionKind(node.attributes);
	if (conditionKind === 'project name') return { kind: 'group', isManagedChild: child => child.name === 'AssemblyName' || child.name === 'RootNamespace' };
	if ((node.name !== 'PropertyGroup' && node.name !== 'ItemGroup') || conditionKind === 'other') return { kind: 'kept' };

	const isManagedChild = node.name === 'PropertyGroup' ? (child: XmlNode) => WRITTEN_PROPERTY_NAMES.has(child.name) : (child: XmlNode) => isManagedItem(child, catalog);
	return { kind: 'group', isManagedChild };
}

function isManagedItem(item: XmlNode, catalog: Catalog): boolean {
	const include = toItemInclude(item.attributes) ?? '';
	if (item.name === 'GlobalPackageReference' || item.name === 'PackageReference') return catalog.packages.has(include);
	if (item.name === 'AdditionalFiles' || item.name === 'GlobalAnalyzerConfigFiles') return ANALYZER_FILE.test(include);
	if (item.name === 'InternalsVisibleTo') return include === TEST_ASSEMBLY_NAME;
	if (item.name === 'ProjectReference') return include === PROJECT_UNDER_TEST_PATH;
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

/** Keeps the lines `isKept` picks, with the comments directly above them, after the generated line they followed. */
function mergeLines(generated: string, existing: string, commentPrefix: string, isKept: (line: string) => boolean): string {
	const lines = generated.replace(/\n+$/, '').split('\n');
	const insertions: Insertion[] = [];
	let anchor = -1;
	let comments: string[] = [];
	for (const line of existing.split('\n')) {
		const text = line.trim();
		if (text === '') {
			comments = [];
		} else if (text.startsWith(commentPrefix)) {
			comments.push(line);
		} else {
			const index = lines.indexOf(line);
			if (index !== -1) anchor = index;
			else if (isKept(line)) insertions.push({ after: anchor, lines: [...comments, line] });
			comments = [];
		}
	}

	return `${applyInsertions(lines, insertions).join('\n')}\n`;
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
