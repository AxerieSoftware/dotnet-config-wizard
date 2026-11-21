import type { Catalog, CatalogRule } from '../catalog/catalog.ts';
import type { RuleParameter } from '../catalog/catalogFiles.ts';
import type { EditorConfigBlock } from '../export/editorConfigDocument.ts';
import type { CommentStyle } from './severityBlocks.ts';

type RuleParameters = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Parameters a rule reads from .editorconfig, such as Meziantou's `MA0048.only_validate_first_type`. */
export function getRuleOptions(rule: CatalogRule): RuleParameter[] {
	return rule.parameters.filter(parameter => parameter.isEditorConfigKey);
}

/** Parameters a rule reads from `SonarLint.xml`, such as S107's maximum parameter count. */
export function getSonarLintParameters(rule: CatalogRule): RuleParameter[] {
	return rule.parameters.filter(parameter => !parameter.isEditorConfigKey);
}

/** The parameters that go in `SonarLint.xml`, leaving out the ones .editorconfig carries. */
export function toSonarLintParameters(ruleParameters: RuleParameters, catalog: Catalog): Record<string, Record<string, string>> {
	return toParametersWhere(ruleParameters, catalog, parameter => !parameter.isEditorConfigKey);
}

/** A scope's rule options as .editorconfig entries, each key exactly as the analyzer reads it. */
export function toRuleOptionBlock(ruleParameters: RuleParameters, catalog: Catalog, commentStyle: CommentStyle): EditorConfigBlock {
	const options = toParametersWhere(ruleParameters, catalog, parameter => parameter.isEditorConfigKey);
	const entries = Object.entries(options)
		.sort(([left], [right]) => left.localeCompare(right))
		.flatMap(([ruleId, values]) => {
			const rule = catalog.rules.get(ruleId);
			return Object.entries(values)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, value]) => ({ comment: commentStyle === 'none' ? undefined : `${ruleId}: ${rule?.title ?? ''}`.trim(), key, value }));
		});
	return { heading: 'Rule options', entries };
}

function toParametersWhere(ruleParameters: RuleParameters, catalog: Catalog, isIncluded: (parameter: RuleParameter) => boolean): Record<string, Record<string, string>> {
	return Object.fromEntries(
		Object.entries(ruleParameters)
			.map(([ruleId, values]) => {
				const parameters = catalog.rules.get(ruleId)?.parameters ?? [];
				// A key the catalog doesn't list is a Sonar parameter, since SonarLint.xml takes any key.
				const included = Object.entries(values).filter(([key]) => {
					const parameter = parameters.find(candidate => candidate.key === key);
					return parameter ? isIncluded(parameter) : isIncluded({ key, description: '', type: '', defaultValue: null, isEditorConfigKey: false });
				});
				return [ruleId, Object.fromEntries(included)] as const;
			})
			.filter(([, values]) => Object.keys(values).length > 0)
	);
}
