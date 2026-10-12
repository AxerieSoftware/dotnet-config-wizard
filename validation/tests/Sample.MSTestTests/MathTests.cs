namespace Sample.MSTestTests;

[TestClass]
public sealed class MathTests
{
	[TestMethod]
	public void Max_TwoNumbers_ReturnsLarger()
	{
		var result = Math.Max(1, 2);

		Assert.AreEqual(2, result);
	}
}
