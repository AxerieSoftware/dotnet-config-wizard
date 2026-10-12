using System.Text.RegularExpressions;

namespace CatalogBuilder;

/// <summary>Where an installed SDK keeps the analyzers that <c>EnforceCodeStyleInBuild</c> and <c>AnalysisLevel</c> run.</summary>
internal sealed partial record SdkLayout(
	string SdkVersion,
	string Band,
	string CodeStyleDirectory,
	string NetAnalyzersDirectory,
	string AnalysisLevelConfigDirectory,
	string RoslynDirectory,
	string FormatToolDirectory)
{
	/// <summary>Folders to resolve analyzer dependencies from. dotnet-format carries the Workspaces build that matches the SDK's Roslyn.</summary>
	public IReadOnlyList<string> ProbeDirectories => [this.CodeStyleDirectory, this.NetAnalyzersDirectory, this.RoslynDirectory, this.FormatToolDirectory];

	public IReadOnlyList<string> CodeStyleAssemblies => Directory.GetFiles(this.CodeStyleDirectory, "*.CodeStyle.dll");

	public IReadOnlyList<string> NetAnalyzersAssemblies => Directory.GetFiles(this.NetAnalyzersDirectory, "*NetAnalyzers.dll")
		.Where(path => !Path.GetFileName(path).Contains("VisualBasic", StringComparison.Ordinal))
		.ToList();

	/// <summary>Resolves the layout and fails loudly if a band has moved any of the folders the catalog depends on.</summary>
	public static SdkLayout Load(string sdkDirectory)
	{
		var sdkVersion = Path.GetFileName(Path.TrimEndingDirectorySeparator(sdkDirectory));
		var netSdkDirectory = Path.Combine(sdkDirectory, "Sdks", "Microsoft.NET.Sdk");
		var codeStyleDirectory = Path.Combine(netSdkDirectory, "codestyle", "cs");
		var netAnalyzersDirectory = Path.Combine(netSdkDirectory, "analyzers");
		var analysisLevelConfigDirectory = Path.Combine(netAnalyzersDirectory, "build", "config");
		var roslynDirectory = Path.Combine(sdkDirectory, "Roslyn", "bincore");
		var formatToolDirectory = Path.Combine(sdkDirectory, "DotnetTools", "dotnet-format");

		string[] requiredDirectories = [codeStyleDirectory, netAnalyzersDirectory, analysisLevelConfigDirectory, roslynDirectory, formatToolDirectory];
		foreach (var directory in requiredDirectories)
		{
			if (!Directory.Exists(directory))
				throw new InvalidOperationException($"SDK folder '{sdkDirectory}' has no '{directory}' folder. Either it isn't an SDK folder such as 'sdk/10.0.300', or the SDK layout changed and SdkLayout needs updating.");
		}

		return new SdkLayout(sdkVersion, ToBand(sdkVersion), codeStyleDirectory, netAnalyzersDirectory, analysisLevelConfigDirectory, roslynDirectory, formatToolDirectory);
	}

	/// <summary>Turns <c>10.0.300</c> into the feature band <c>10.0.3xx</c>.</summary>
	private static string ToBand(string sdkVersion)
	{
		var match = SdkVersionPattern().Match(sdkVersion);
		if (!match.Success)
			throw new InvalidOperationException($"SDK folder name '{sdkVersion}' isn't an SDK version such as '10.0.300'.");

		return $"{match.Groups["major"].Value}.{match.Groups["minor"].Value}.{match.Groups["feature"].Value}xx";
	}

	[GeneratedRegex(@"^(?<major>\d+)\.(?<minor>\d+)\.(?<feature>\d)\d{2}(-.+)?$")]
	private static partial Regex SdkVersionPattern();
}
