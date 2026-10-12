namespace CatalogBuilder.Tests;

[TestClass]
public sealed class AnalysisLevelReaderTests
{
	[TestMethod]
	public void ReadSeverities_GlobalConfigLines_KeepsEnabledRulesOnly()
	{
		string[] lines =
		[
			"is_global = true",
			"global_level = -100",
			"# CA1000: Do not declare static members on generic types",
			"dotnet_diagnostic.CA1000.severity = warning",
			"dotnet_diagnostic.CA1001.severity = none",
			"dotnet_diagnostic.CA1002.severity = suggestion"
		];

		var severities = AnalysisLevelReader.ReadSeverities(lines);

		CollectionAssert.AreEquivalent(
			new Dictionary<string, string> { ["CA1000"] = "warning", ["CA1002"] = "suggestion" },
			severities.ToDictionary());
	}
}
