/**
 * Renders `SonarLint.xml`, the additional file SonarAnalyzer reads rule parameters from, such as S107's maximum
 * parameter count. Only parameters that differ from Sonar's defaults need listing.
 */
export function toSonarLintXml(ruleParameters: Readonly<Record<string, Record<string, string>>>): string {
	const rules = Object.entries(ruleParameters)
		.filter(([, parameters]) => Object.keys(parameters).length > 0)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([ruleId, parameters]) => {
			const parameterLines = Object.entries(parameters).map(
				([key, value]) => `        <Parameter>\n          <Key>${escapeXml(key)}</Key>\n          <Value>${escapeXml(value)}</Value>\n        </Parameter>`
			);
			return `    <Rule>\n      <Key>${escapeXml(ruleId)}</Key>\n      <Parameters>\n${parameterLines.join('\n')}\n      </Parameters>\n    </Rule>`;
		});

	return `<?xml version="1.0" encoding="UTF-8"?>\n<AnalysisInput>\n  <Rules>\n${rules.join('\n')}\n  </Rules>\n</AnalysisInput>\n`;
}

function escapeXml(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
