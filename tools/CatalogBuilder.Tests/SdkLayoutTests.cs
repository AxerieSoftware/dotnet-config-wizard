namespace CatalogBuilder.Tests;

[TestClass]
public sealed class SdkLayoutTests
{
	[TestMethod]
	public void Load_FolderWithoutAnalyzers_ThrowsNamingTheMissingFolder()
	{
		var sdkDirectory = Directory.CreateTempSubdirectory().FullName;

		var exception = Assert.ThrowsExactly<InvalidOperationException>(() => SdkLayout.Load(sdkDirectory));

		StringAssert.Contains(exception.Message, "codestyle");
	}
}
