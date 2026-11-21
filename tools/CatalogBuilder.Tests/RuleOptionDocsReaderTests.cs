using CatalogBuilder.Models;

namespace CatalogBuilder.Tests;

[TestClass]
public sealed class RuleOptionDocsReaderTests
{
	private static readonly IReadOnlyList<RuleParameter> Parameters = RuleOptionDocsReader.ReadDocument(
		"MA9999",
		File.ReadAllLines(Path.Combine(AppContext.BaseDirectory, "Fixtures", "rule-options", "MA9999.md")));

	[TestMethod]
	public void ReadDocument_ConfigurationBlock_ReadsOnlyItsOptionKeys()
	{
		CollectionAssert.AreEqual(
			new[] { "MA9999.exclude_file_local_types", "MA9999.mode", "MA9999.excluded_parts", "dotnet_diagnostic.MA9999.excluded_symbol_names" },
			Parameters.Select(parameter => parameter.Key).ToList());
		Assert.IsTrue(Parameters.All(parameter => parameter.IsEditorConfigKey));
	}

	[TestMethod]
	public void ReadDocument_BooleanDefault_SetsBooleanTypeAndDefault()
	{
		var parameter = Parameters[0];

		Assert.AreEqual("Boolean", parameter.Type);
		Assert.AreEqual("true", parameter.DefaultValue);
		Assert.AreEqual("Skip file-local types.", parameter.Description);
	}

	[TestMethod]
	public void ReadDocument_DefaultOfNone_LeavesDefaultUnset()
	{
		var parameter = Parameters[2];

		Assert.IsNull(parameter.DefaultValue);
		Assert.AreEqual("String", parameter.Type);
	}

	[TestMethod]
	public void ReadDocument_SeveralCommentLines_JoinsThemIntoTheDescription()
	{
		Assert.AreEqual("Matching mode. Allowed values: Exact, Prefix.", Parameters[1].Description);
		Assert.AreEqual("Exact", Parameters[1].DefaultValue);
	}

	[TestMethod]
	public void ReadDocument_NoConfigurationHeading_ReturnsNothing()
	{
		Assert.AreEqual(0, RuleOptionDocsReader.ReadDocument("MA9999", ["# MA9999", "MA9999.mode = Exact"]).Count);
	}
}
