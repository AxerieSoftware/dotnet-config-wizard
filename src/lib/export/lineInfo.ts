import { BUILD_PROPERTIES_BY_NAME } from '../build/buildProperties.ts';
import type { Catalog, CatalogOption } from '../catalog/catalog.ts';
import { FORMATTING_GLOBS, FORMATTING_KEYS } from '../formatting/formattingKeys.ts';
import { STEP_PATHS } from '../ui/wizardSteps.ts';
import { toFileName } from './fileTree.ts';
import type { GeneratedFile } from './generatedFile.ts';
import { toCodeLanguage } from './highlighter.ts';

/**
 * Where a line is set in the wizard: the step, the control to focus there, and for a rule, the search that shows it in
 * the rule table.
 */
export type LineTarget = { path: string; selector?: string; ruleSearch?: string };

/** What a line of a generated file does, shown when hovering it. `href` points at the rule or option page. */
/** Where a generated line is: the file's path and the line's index in it. */
export type SettingLine = { path: string; index: number };

export type LineInfo = { title: string; details: string[]; href?: string; target?: LineTarget; option?: { option: CatalogOption; value: string } };

const PACKAGES_STEP_GROUPS = ['Central package management', 'NuGet audit and lock files'];

const EDITORCONFIG_LINE = /^([\w.-]+)\s*=\s*(.*)$/;
const SECTION_LINE = /^\[.+\]$/;
const RULE_SEVERITY = /^dotnet_diagnostic\.(\w+)\.severity$/;
const CATEGORY_SEVERITY = /^dotnet_analyzer_diagnostic\.category-(\w+)\.severity$/;
const NAMING_PART = /^dotnet_naming_(rule|symbols|style)\.(\w+)\.(\w+)$/;
const MSBUILD_PROPERTY = /^<(\w+)>([^<]*)<\/\1>$/;
const PACKAGE_ITEM = /^<(GlobalPackageReference|PackageReference|PackageVersion) (Include|Remove)="([^"]+)"/;
const JSON_PROPERTY = /^"([\w-]+)":\s*(.+?),?$/;
const BANNED_SYMBOL = /^([TMPFEN]):([^;]+);(.*)$/;

const NAMING_PARTS: Readonly<Record<string, string>> = {
	rule: 'Ties a group of symbols to a naming style, at a severity IDE1006 reports.',
	symbols: 'Which symbols the naming rule covers: their kinds, accessibilities and modifiers.',
	style: 'How the names must look: capitalization, prefix, suffix and word separator.'
};

const GLOBAL_JSON_KEYS: Readonly<Record<string, { description: string; target: LineTarget }>> = {
	version: { description: 'The SDK every machine and CI agent builds with.', target: { path: STEP_PATHS.start, selector: '[aria-label="SDK band"]' } },
	rollForward: { description: 'Which newer installed SDKs may stand in for the pinned one.', target: { path: STEP_PATHS.sdk, selector: '[aria-label="Roll forward"]' } },
	allowPrerelease: { description: 'Whether preview SDKs may build the repo. True only for a preview band.', target: { path: STEP_PATHS.start, selector: '[aria-label="SDK band"]' } },
	runner: { description: 'Runs dotnet test on Microsoft.Testing.Platform instead of VSTest.', target: { path: STEP_PATHS.sdk } }
};

/** The `.editorconfig` section each line is in, such as `[*.cs]`, so formatting keys know which file type they set. */
export function toLineSections(lines: readonly string[]): (string | undefined)[] {
	let section: string | undefined;
	return lines.map(line => {
		if (SECTION_LINE.test(line.trim())) section = line.trim();
		return section;
	});
}

/** The line a control sets, found by matching the control against what each line's explanation points to. */
export function findSettingLine(files: readonly GeneratedFile[], control: Element, catalog: Catalog): SettingLine | undefined {
	for (const file of files) {
		const lines = file.content.split('\n');
		const sections = toLineSections(lines);
		const index = lines.findIndex((line, lineIndex) => {
			const selector = describeLine(file.path, line, sections[lineIndex], catalog)?.target?.selector;
			return selector !== undefined && control.matches(selector);
		});
		if (index !== -1) return { path: file.path, index };
	}

	return undefined;
}

/**
 * Explains one line of a generated file, or returns undefined for comments, blank lines and structure. `section` is the
 * `.editorconfig` section the line is in, such as `[*.cs]`.
 */
export function describeLine(path: string, line: string, section: string | undefined, catalog: Catalog): LineInfo | undefined {
	const text = line.trim();
	if (text === '' || text.startsWith('#') || text.startsWith('<!--')) return undefined;

	const language = toCodeLanguage(path);
	if (language === 'ini') return describeEditorConfigLine(text, section, catalog);
	if (language === 'xml') return describeMsBuildLine(text, catalog);
	if (language === 'json') return describeJsonLine(text);
	const fileName = toFileName(path);
	if (fileName === 'BannedSymbols.txt') return describeBannedSymbol(text);
	if (fileName === '.gitattributes')
		return {
			title: text,
			details: ['Tells Git which line endings to store and check out for matching files, so formatting rules see the same file on every machine.'],
			target: { path: STEP_PATHS.formatting }
		};
	return undefined;
}

function describeEditorConfigLine(text: string, section: string | undefined, catalog: Catalog): LineInfo | undefined {
	if (text.startsWith('[')) return { title: text, details: [`The settings below apply to files matching ${text.slice(1, -1)}, in this folder and below.`], target: { path: STEP_PATHS.formatting } };

	const match = EDITORCONFIG_LINE.exec(text);
	if (!match) return undefined;

	const [, key, value] = match;
	if (key === 'root') return { title: 'root = true', details: ['Editors and the compiler stop looking for .editorconfig files in folders above this one.'] };
	if (key === 'generated_code')
		return {
			title: `generated_code = ${value}`,
			details: ["Treats this folder's C# as generated code: analyzers skip it and nullable warnings are off, but it still has to compile."]
		};
	if (key === 'is_global') return { title: 'is_global = true', details: ['Makes this a global analyzer config: its settings apply to every file of each project that includes it.'] };

	const ruleId = RULE_SEVERITY.exec(key)?.[1];
	if (ruleId) return describeRule(ruleId, value, catalog);

	const category = CATEGORY_SEVERITY.exec(key)?.[1];
	if (category)
		return {
			title: `${category} category`,
			details: [`Sets every analyzer rule in the ${category} category to ${value}.`, 'A rule with its own severity line keeps that severity. Compiler warnings are never affected.'],
			target: { path: STEP_PATHS.analyzers, selector: `[aria-label="${category} category severity"]` }
		};
	if (key === 'dotnet_analyzer_diagnostic.severity')
		return { title: 'Every analyzer rule', details: [`Sets every analyzer rule to ${value}, unless a category or rule says otherwise.`], target: { path: STEP_PATHS.analyzers } };

	const namingPart = NAMING_PART.exec(key);
	if (namingPart)
		return {
			title: `Naming ${namingPart[1]}: ${namingPart[2]}`,
			details: [NAMING_PARTS[namingPart[1]], `Sets ${namingPart[3].replaceAll('_', ' ')} to ${value}.`],
			target: { path: STEP_PATHS.naming, ...(namingPart[1] === 'symbols' ? { selector: `[aria-label="Naming rule ${namingPart[2]}"]` } : {}) }
		};

	const option = catalog.options.get(key);
	if (option) {
		// The value meanings and example render from the option itself, as they do on the Code style step.
		return {
			title: key,
			details: [option.groupTitle, ...(option.ruleIds.length > 0 ? [`How loudly it's enforced comes from ${option.ruleIds.join(', ')}.`] : [])],
			href: `/options/${key}`,
			option: { option, value },
			...(option.languages.includes('csharp') ? { target: { path: STEP_PATHS.codeStyle, selector: `[aria-label="${key}"]` } } : {})
		};
	}

	const formattingKey = FORMATTING_KEYS.find(entry => entry.key === key);
	if (formattingKey) {
		const sectionTitle = FORMATTING_GLOBS.find(glob => glob.glob === section)?.title;
		return {
			title: formattingKey.label,
			details: [`${key} = ${value} for the files this section matches.`],
			target: { path: STEP_PATHS.formatting, ...(sectionTitle ? { selector: `[aria-label="${sectionTitle}: ${formattingKey.label}"]` } : {}) }
		};
	}
	return undefined;
}

function describeRule(ruleId: string, severity: string, catalog: Catalog): LineInfo {
	const rule = catalog.rules.get(ruleId);
	if (!rule) return { title: ruleId, details: [`Sets ${ruleId} to ${severity}.`] };

	// Code-style rules tied to an option sit next to it on the Code style step; every other rule is in the rule table.
	const isOnCodeStyleStep = catalog.options.values().some(option => option.languages.includes('csharp') && option.ruleIds.includes(ruleId));
	const selector = `[aria-label="${ruleId} severity"]`;

	const defaultSeverity = rule.isEnabledByDefault ? rule.defaultSeverity : 'off';
	return {
		title: `${rule.id}: ${rule.title}`,
		details: [
			`${rule.sourceTitle} · ${rule.category}`,
			`Set to ${severity}; the default is ${defaultSeverity}.`,
			...(rule.isEnforcedOnBuild ? [] : ['dotnet build never runs this rule; only the editor reports it.']),
			...(rule.hasCodeFix ? ['Has a code fix.'] : [])
		],
		href: `/rules/${rule.id}`,
		target: isOnCodeStyleStep ? { path: STEP_PATHS.codeStyle, selector } : { path: STEP_PATHS.analyzers, selector, ruleSearch: ruleId }
	};
}

function describeMsBuildLine(text: string, catalog: Catalog): LineInfo | undefined {
	const property = MSBUILD_PROPERTY.exec(text);
	if (property?.[1] === 'TargetFramework' || property?.[1] === 'TargetFrameworks') {
		return {
			title: `${property[1]} = ${property[2] || '(cleared)'}`,
			details: [
				property[2]
					? 'Sets the frameworks for every project in this folder, so project files can leave them out.'
					: 'Clears the value from the folder above, so each project here sets its own frameworks.'
			],
			target: { path: STEP_PATHS.build, selector: '[data-setting="TargetFramework"]' }
		};
	}
	if (property) {
		const known = BUILD_PROPERTIES_BY_NAME.get(property[1]);
		if (known) {
			const details = [known.description.replaceAll('`', ''), known.group];
			// Properties the Analyzers step sets have their own controls there, marked with the property they set.
			if (known.isOnAnalyzersStep) return { title: `${known.name} = ${property[2]}`, details, target: { path: STEP_PATHS.analyzers, selector: `[data-setting="${known.name}"]` } };

			const step = PACKAGES_STEP_GROUPS.includes(known.group) ? STEP_PATHS.packages : STEP_PATHS.build;
			return { title: `${known.name} = ${property[2]}`, details, target: { path: step, selector: `[aria-label="${known.name}"]` } };
		}
	}

	const packageItem = PACKAGE_ITEM.exec(text);
	if (packageItem) {
		const [, itemType, action, packageId] = packageItem;
		const entry = catalog.packages.get(packageId);
		const verb = toPackageItemVerb(itemType, action);
		return {
			title: entry ? `${entry.title} (${packageId})` : packageId,
			details: [
				`${verb} ${packageId}${itemType === 'GlobalPackageReference' ? ' in every project, without passing it on to consumers' : ''}.`,
				...(entry ? [`${entry.ruleCount} rules · released ${entry.latestPublished}`] : [])
			],
			target: entry ? { path: STEP_PATHS.analyzers, selector: `[data-package="${packageId}"]` } : { path: STEP_PATHS.packages }
		};
	}

	if (text.startsWith('<Import ')) return { title: 'Import the folder above', details: ["Loads the parent folder's file first, so this one only holds what this folder changes."] };
	if (text.includes('Label="Continuous integration"')) return { title: 'CI builds', details: ['Applies when CI or TF_BUILD is true, as GitHub Actions and Azure Pipelines set.'] };
	if (text.includes('Label="CI builds only"')) return { title: 'CI builds only', details: ['These properties only apply to CI builds, so local builds stay forgiving.'] };
	if (text === '<clear />')
		return { title: 'Clear package sources', details: ['Drops sources from machine and user config, so every restore uses only the sources below.'], target: { path: STEP_PATHS.packages } };
	if (text.startsWith('<packageSource ') || text.startsWith('<add ') || text.startsWith('<package '))
		return { title: 'Package sources', details: ['Where packages come from, and which package IDs each source may serve.'], target: { path: STEP_PATHS.packages } };
	if (text.startsWith('<AdditionalFiles '))
		return { title: 'Analyzer input file', details: ['Hands this file to analyzers, such as BannedSymbols.txt to RS0030.'], target: { path: STEP_PATHS.analyzers } };
	return undefined;
}

function toPackageItemVerb(itemType: string, action: string): string {
	if (action === 'Remove') return 'Removes';
	if (itemType === 'PackageVersion') return 'Sets the central version of';
	return 'References';
}

function describeJsonLine(text: string): LineInfo | undefined {
	const match = JSON_PROPERTY.exec(text);
	const globalJsonKey = match ? GLOBAL_JSON_KEYS[match[1]] : undefined;
	return globalJsonKey && match ? { title: `${match[1]}: ${match[2]}`, details: [globalJsonKey.description], target: globalJsonKey.target } : undefined;
}

function describeBannedSymbol(text: string): LineInfo | undefined {
	const match = BANNED_SYMBOL.exec(text);
	if (!match) return undefined;

	return { title: match[2], details: [`RS0030 reports every use of ${match[2]}.`, match[3]], target: { path: STEP_PATHS.analyzers } };
}
