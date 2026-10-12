using Xunit;

namespace Sample.XunitTests;

public class StringTests
{
	[Fact]
	public void Concat_TwoWords_JoinsThem()
	{
		var result = string.Concat("a", "b");

		Assert.Equal("ab", result);
	}
}
