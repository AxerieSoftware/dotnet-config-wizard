namespace Sample.Greeting.Tests;

[TestClass]
public sealed class GreetingTests
{
	[TestMethod]
	public void ToGreeting_Name_GreetsByName()
	{
		var greeting = Greeter.ToGreeting("Ada");

		Assert.AreEqual("Hello, Ada", greeting);
	}
}
