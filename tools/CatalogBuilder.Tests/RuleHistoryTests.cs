namespace CatalogBuilder.Tests;

[TestClass]
public sealed class RuleHistoryTests
{
	[TestMethod]
	public void Update_ExistingAndNewIds_KeepsOldDatesAndDatesNewOnes()
	{
		var history = RuleHistory.Update("""{ "CA1000": "2026-10-12" }""", ["CA1000", "CA9999"], new DateOnly(2026, 11, 2));

		CollectionAssert.AreEquivalent(new Dictionary<string, string> { ["CA1000"] = "2026-10-12", ["CA9999"] = "2026-11-02" }, history.ToDictionary());
	}
}
