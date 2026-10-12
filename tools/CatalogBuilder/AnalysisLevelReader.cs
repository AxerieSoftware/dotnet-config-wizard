using System.Text.RegularExpressions;

namespace CatalogBuilder;

/// <summary>
/// Reads the SDK's <c>analysislevel_&lt;level&gt;_&lt;mode&gt;.globalconfig</c> files into level, then mode, then rule ID to severity.
/// Per-category and <c>_warnaserror</c> variants are skipped because they're filtered or promoted copies of these files.
/// </summary>
internal static partial class AnalysisLevelReader
{
	private const string DisabledSeverity = "none";

	public static IReadOnlyDictionary<string, IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>> Read(string configDirectory)
	{
		var levels = new SortedDictionary<string, IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>>(StringComparer.Ordinal);
		var files = Directory.GetFiles(configDirectory, "analysislevel_*.globalconfig")
			.Select(path => (Path: path, Match: FileNamePattern().Match(Path.GetFileName(path))))
			.Where(file => file.Match.Success)
			.GroupBy(file => file.Match.Groups["level"].Value);

		foreach (var levelFiles in files)
		{
			var modes = new SortedDictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.Ordinal);
			foreach (var file in levelFiles)
				modes[file.Match.Groups["mode"].Value] = ReadSeverities(File.ReadLines(file.Path));

			levels[levelFiles.Key] = modes;
		}

		return levels;
	}

	public static IReadOnlyDictionary<string, string> ReadSeverities(IEnumerable<string> lines)
	{
		var severities = new SortedDictionary<string, string>(StringComparer.Ordinal);
		foreach (var line in lines)
		{
			var match = SeverityPattern().Match(line);
			if (!match.Success || match.Groups["severity"].Value == DisabledSeverity)
				continue;

			severities[match.Groups["id"].Value] = match.Groups["severity"].Value;
		}

		return severities;
	}

	[GeneratedRegex(@"^analysislevel_(?<level>\d+)_(?<mode>none|minimum|recommended|default|all)\.globalconfig$")]
	private static partial Regex FileNamePattern();

	[GeneratedRegex(@"^\s*dotnet_diagnostic\.(?<id>[A-Za-z0-9]+)\.severity\s*=\s*(?<severity>\w+)\s*$")]
	private static partial Regex SeverityPattern();
}
