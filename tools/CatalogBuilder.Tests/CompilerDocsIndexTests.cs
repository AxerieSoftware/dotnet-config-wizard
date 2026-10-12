namespace CatalogBuilder.Tests;

[TestClass]
public sealed class CompilerDocsIndexTests
{
	[TestMethod]
	public void ReadFrontMatterIds_QuotedAndCommentedKeywords_ReturnsOnlyFrontMatterIds()
	{
		string[] lines =
		[
			"---",
			"title: Nullable reference type warnings",
			"f1_keywords:",
			"  - \"CS8600\" # WRN_ConvertingNullableToNonNullable",
			"  - CS8618",
			"---",
			"- CS9999 appears in the body, not the front matter."
		];

		var ids = CompilerDocsIndex.ReadFrontMatterIds(lines).ToList();

		CollectionAssert.AreEqual(new[] { "CS8600", "CS8618" }, ids);
	}
}
