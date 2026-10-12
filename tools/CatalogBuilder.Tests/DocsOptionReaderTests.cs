using CatalogBuilder.Models;

namespace CatalogBuilder.Tests;

[TestClass]
public sealed class DocsOptionReaderTests
{
	private static readonly StyleOptionCatalog Catalog = DocsOptionReader.Read(Path.Combine(AppContext.BaseDirectory, "Fixtures"));

	[TestMethod]
	public void Read_RuleTableWithSeveralIds_ReturnsOneRulePerId()
	{
		var ruleIds = Catalog.Rules.Select(rule => rule.Id).ToList();

		CollectionAssert.AreEquivalent(new[] { "IDE0003", "IDE0390", "IDE0391" }, ruleIds);
	}

	[TestMethod]
	public void Read_OptionListedByRuleTable_MapsOptionToRuleAndSubcategory()
	{
		var option = Catalog.Options.Single(option => option.Name == "dotnet_style_qualification_for_field");

		CollectionAssert.AreEqual(new[] { "IDE0003" }, option.RuleIds.ToList());
		Assert.AreEqual("Language rules ('this.' and 'Me.' qualifiers)", option.Group);
		CollectionAssert.AreEqual(new[] { "csharp", "visualbasic" }, option.Languages.ToList());
	}

	[TestMethod]
	public void Read_DefaultWithLegacySeveritySuffix_DropsSuffix()
	{
		var option = Catalog.Options.Single(option => option.Name == "dotnet_style_qualification_for_field");

		Assert.AreEqual("false", option.DefaultValue);
	}

	[TestMethod]
	public void Read_OptionFollowedByCSharpBlock_UsesItAsExample()
	{
		var option = Catalog.Options.Single(option => option.Name == "dotnet_style_qualification_for_field");

		Assert.AreEqual("// dotnet_style_qualification_for_field = true\nthis.capacity = 0;", option.Example);
	}

	[TestMethod]
	public void Read_CSharpBlockAfterNextHeading_IsNotUsedAsExample()
	{
		var option = Catalog.Options.Single(option => option.Name == "csharp_new_line_before_else");

		Assert.IsNull(option.Example);
	}

	[TestMethod]
	public void Read_ValueRowWithSeveralCodes_AllowsMultipleValues()
	{
		var option = Catalog.Options.Single(option => option.Name == "csharp_new_line_before_open_brace");

		Assert.IsTrue(option.AllowsMultipleValues);
		CollectionAssert.AreEqual(new[] { "all", "none", "methods", "properties", "types" }, option.Values.Select(value => value.Value).ToList());
	}

	[TestMethod]
	public void Read_FormattingOptionWithoutRuleTable_MapsToIde0055AndSectionGroup()
	{
		var option = Catalog.Options.Single(option => option.Name == "csharp_new_line_before_open_brace");

		CollectionAssert.AreEqual(new[] { "IDE0055" }, option.RuleIds.ToList());
		Assert.AreEqual("New-line options", option.Group);
	}
}
