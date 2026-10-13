/** One line inside a generated MSBuild file, already indented by its caller. */
export type XmlLine = string;

export function escapeXml(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** An element with text content, such as `<Nullable>enable</Nullable>`. */
export function toElement(name: string, value: string): XmlLine {
	return `<${name}>${escapeXml(value)}</${name}>`;
}

/** An item element, such as `<AdditionalFiles Include="…" />`, with attributes in the given order. */
export function toItem(itemType: string, attributes: Record<string, string>): XmlLine {
	const renderedAttributes = Object.entries(attributes).map(([name, value]) => ` ${name}="${escapeXml(value)}"`);
	return `<${itemType}${renderedAttributes.join('')} />`;
}

/** A labeled group, such as a `PropertyGroup` or `ItemGroup`, with its lines indented one level. Empty groups render nothing. */
export function toGroup(groupType: 'PropertyGroup' | 'ItemGroup', label: string, lines: readonly XmlLine[], condition?: string): XmlLine[] {
	if (lines.length === 0) return [];

	const conditionAttribute = condition ? ` Condition="${escapeXml(condition)}"` : '';
	return [`<${groupType} Label="${escapeXml(label)}"${conditionAttribute}>`, ...lines.map(line => `\t${line}`), `</${groupType}>`];
}

/** A `<Project>` document whose blocks are separated by blank lines. */
export function toProjectDocument(blocks: readonly (readonly XmlLine[])[]): string {
	const body = blocks
		.filter(block => block.length > 0)
		.map(block => block.map(line => `\t${line}`).join('\n'))
		.join('\n\n');
	return `<Project>\n${body}\n</Project>\n`;
}

/** Imports the same file from the folder above, so a nested file adds to its parent instead of replacing it. */
export function toParentImport(fileName: string): XmlLine[] {
	return [`<!-- Explicitly import the parent ${fileName} -->`, `<Import Project="$([MSBuild]::GetPathOfFileAbove('${fileName}', '$(MSBuildThisFileDirectory)../'))" />`];
}
