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
	hasCodeFix: boolean;
	/** Compiler warnings only: 1 to 4 are always on; 5 and up are warning waves that AnalysisLevel turns on. */
	warningLevel: number | null;
	/** Settings read from an additional file rather than .editorconfig, such as Sonar's `SonarLint.xml`. */
	parameters: RuleParameter[];
};

export type RuleParameter = { key: string; description: string; type: string; defaultValue: string | null };

/** One entry of `catalog/generated/packages.json`: an analyzer package with its maintenance details. */
export type PackageEntry = {
	id: string;
	title: string;
	/** The package or SDK that already brings these analyzers in, such as xunit.v3; the wizard never references them itself. */
	includedWith: string | null;
	version: string;
	latestVersion: string;
	latestPublished: string;
	isDeprecated: boolean;
	isStale: boolean;
	ruleCount: number;
};

/** Shape of `catalog/generated/package-<id>.json`: an analyzer package's rules. */
export type PackageCatalogFile = { id: string; version: string; rules: SdkRuleEntry[] };

/** One entry of `catalog/generated/bands.json`: an SDK band the catalog covers, with its support details. */
export type BandEntry = {
	band: string;
	sdkVersion: string;
	channel: string;
	supportPhase: string;
	releaseType: string;
	endOfLifeDate: string | null;
	isPreview: boolean;
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
	/** Such as `12.0`. Set only when every rule the option feeds needs a newer language version. */
	minimumCSharpVersion: string | null;
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
	minimumCSharpVersion: string | null;
	optionNames: string[];
	docFile: string;
};
