namespace CatalogBuilder.Models;

/// <summary>
/// Everything extracted from one installed SDK band. <c>AnalysisLevels</c> maps level, then mode, then rule ID to severity,
/// including <c>none</c>. Rules a mode doesn't list keep their analyzer's own default.
/// </summary>
internal sealed record SdkCatalog(
	string SdkVersion,
	string Band,
	IReadOnlyList<RuleEntry> Rules,
	IReadOnlyDictionary<string, IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>> AnalysisLevels);
