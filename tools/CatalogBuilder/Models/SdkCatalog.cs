namespace CatalogBuilder.Models;

/// <summary>
/// Everything extracted from one installed SDK band. <c>AnalysisLevels</c> maps level, then mode, then rule ID to severity,
/// leaving out rules a level sets to <c>none</c>.
/// </summary>
internal sealed record SdkCatalog(
	string SdkVersion,
	string Band,
	IReadOnlyList<RuleEntry> Rules,
	IReadOnlyDictionary<string, IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>> AnalysisLevels);
