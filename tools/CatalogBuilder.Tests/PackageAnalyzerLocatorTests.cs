namespace CatalogBuilder.Tests;

[TestClass]
public sealed class PackageAnalyzerLocatorTests
{
	private static readonly Version HostRoslynVersion = new(5, 0);

	[TestMethod]
	public void Find_VersionedFolders_PicksNewestTheHostCanLoad()
	{
		var packageDirectory = CreatePackage("analyzers/dotnet/roslyn4.8/cs/A.dll", "analyzers/dotnet/roslyn5.0/cs/A.dll", "analyzers/dotnet/roslyn5.6/cs/A.dll");

		var assemblies = PackageAnalyzerLocator.Find(packageDirectory, HostRoslynVersion);

		CollectionAssert.AreEqual(new[] { "roslyn5.0" }, assemblies.Select(path => Path.GetFileName(Path.GetDirectoryName(Path.GetDirectoryName(path)))).ToList());
	}

	[TestMethod]
	public void Find_UnversionedLayouts_ReadsRootLanguageNeutralAndCSharpFolders()
	{
		var packageDirectory = CreatePackage("analyzers/Root.dll", "analyzers/dotnet/Neutral.dll", "analyzers/dotnet/cs/CSharp.dll", "analyzers/dotnet/vb/VisualBasic.dll");

		var assemblies = PackageAnalyzerLocator.Find(packageDirectory, HostRoslynVersion);

		CollectionAssert.AreEquivalent(new[] { "Root.dll", "Neutral.dll", "CSharp.dll" }, assemblies.Select(Path.GetFileName).ToList());
	}

	private static string CreatePackage(params string[] relativePaths)
	{
		var packageDirectory = Directory.CreateTempSubdirectory().FullName;
		foreach (var relativePath in relativePaths)
		{
			var path = Path.Combine(packageDirectory, relativePath);
			Directory.CreateDirectory(Path.GetDirectoryName(path)!);
			File.WriteAllText(path, "");
		}

		return packageDirectory;
	}
}
