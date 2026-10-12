/** Shape of `catalog/generated/sdk-<band>.json`, written by CatalogBuilder. */
export type SdkCatalogFile = {
	sdkVersion: string;
	band: string;
	rules: SdkRuleEntry[];
	analysisLevels: Record<string, Record<string, Record<string, string>>>;
};

export type SdkRuleEntry = {
	id: string;
	source: string;
	title: string;
	category: string;
	defaultSeverity: string;
	isEnabledByDefault: boolean;
	helpLink: string | null;
	description: string | null;
	tags: string[];
};

/** Shape of `catalog/generated/style-options.json`, written by CatalogBuilder from dotnet/docs. */
export type StyleOptionCatalogFile = {
	options: StyleOptionEntry[];
	rules: StyleRuleDoc[];
};

export type StyleOptionEntry = {
	name: string;
	group: string;
	languages: string[];
	values: { value: string; description: string }[];
	allowsMultipleValues: boolean;
	defaultValue: string | null;
	ruleIds: string[];
	example: string | null;
	docFile: string;
};

export type StyleRuleDoc = {
	id: string;
	title: string;
	category: string;
	subcategory: string | null;
	languages: string[];
	optionNames: string[];
	docFile: string;
};
