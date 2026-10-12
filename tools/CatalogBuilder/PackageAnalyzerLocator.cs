using System.Text.RegularExpressions;

namespace CatalogBuilder;

/// <summary>
/// Finds the C# analyzer assemblies in an extracted package. Packages put them in <c>analyzers/dotnet/cs</c>, in
/// Roslyn-versioned folders such as <c>analyzers/dotnet/roslyn4.14/cs</c>, in language-neutral <c>analyzers/dotnet</c>,
/// or at the <c>analyzers</c> root. Of versioned folders, the newest one the host's Roslyn can load wins.
/// </summary>
internal static partial class PackageAnalyzerLocator
{
	public static IReadOnlyList<string> Find(string packageDirectory, Version hostRoslynVersion)
	{
		var analyzersDirectory = Path.Combine(packageDirectory, "analyzers");
		if (!Directory.Exists(analyzersDirectory))
			return [];

		var dotnetDirectory = Path.Combine(analyzersDirectory, "dotnet");
		var versionedDirectory = FindNewestLoadableRoslynDirectory(dotnetDirectory, hostRoslynVersion);
		string[] candidateDirectories = versionedDirectory is null
			? [analyzersDirectory, dotnetDirectory, Path.Combine(dotnetDirectory, "cs")]
			: [versionedDirectory, Path.Combine(versionedDirectory, "cs")];

		return candidateDirectories
			.Where(Directory.Exists)
			.SelectMany(directory => Directory.GetFiles(directory, "*.dll"))
			.Order(StringComparer.Ordinal)
			.ToList();
	}

	private static string? FindNewestLoadableRoslynDirectory(string dotnetDirectory, Version hostRoslynVersion)
	{
		if (!Directory.Exists(dotnetDirectory))
			return null;

		return Directory.GetDirectories(dotnetDirectory)
			.Select(directory => (Directory: directory, Match: RoslynFolderPattern().Match(Path.GetFileName(directory))))
			.Where(candidate => candidate.Match.Success)
			.Select(candidate => (candidate.Directory, Version: Version.Parse(candidate.Match.Groups["version"].Value)))
			.Where(candidate => candidate.Version <= hostRoslynVersion)
			.OrderByDescending(candidate => candidate.Version)
			.Select(candidate => candidate.Directory)
			.FirstOrDefault();
	}

	[GeneratedRegex(@"^roslyn(?<version>\d+\.\d+)$")]
	private static partial Regex RoslynFolderPattern();
}
