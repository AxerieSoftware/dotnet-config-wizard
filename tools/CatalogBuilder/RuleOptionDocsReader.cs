using System.Formats.Tar;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using CatalogBuilder.Models;

namespace CatalogBuilder;

/// <summary>
/// Reads the options a package documents under a <c># Configuration</c> heading on each rule's page, such as Meziantou's
/// <c>MA0048.only_validate_first_type</c>. The analyzers read them from .editorconfig, and only the docs list them.
/// </summary>
internal static partial class RuleOptionDocsReader
{
	private const string BooleanType = "Boolean";
	private const string StringType = "String";
	private const string NoDefault = "none";

	/// <summary>Downloads the docs at the tag matching <paramref name="version"/> once, and returns each rule's options by ID.</summary>
	public static async Task<IReadOnlyDictionary<string, IReadOnlyList<RuleParameter>>> ReadAsync(HttpClient httpClient, RuleOptionDocs docs, string version, string cacheDirectory)
	{
		var archivePath = Path.Combine(cacheDirectory, "rule-option-docs", $"{docs.Repository.Replace('/', '-')}-{version}.tar.gz");
		if (!File.Exists(archivePath))
		{
			Directory.CreateDirectory(Path.GetDirectoryName(archivePath)!);
			var bytes = await httpClient.GetByteArrayAsync($"https://codeload.github.com/{docs.Repository}/tar.gz/refs/tags/{version}");
			await File.WriteAllBytesAsync(archivePath, bytes);
		}

		var options = new Dictionary<string, IReadOnlyList<RuleParameter>>(StringComparer.Ordinal);
		await using var archive = new GZipStream(File.OpenRead(archivePath), CompressionMode.Decompress);
		await using var reader = new TarReader(archive);
		while (await reader.GetNextEntryAsync() is { } entry)
		{
			// GitHub archives put every path under a "<repo>-<tag>/" folder.
			var path = entry.Name[(entry.Name.IndexOf('/', StringComparison.Ordinal) + 1)..];
			if (entry.DataStream is null || !path.StartsWith($"{docs.Path}/", StringComparison.Ordinal) || !path.EndsWith(".md", StringComparison.Ordinal))
				continue;

			using var text = new StreamReader(entry.DataStream, Encoding.UTF8);
			var ruleId = Path.GetFileNameWithoutExtension(path);
			var parameters = ReadDocument(ruleId, (await text.ReadToEndAsync()).Split('\n'));
			if (parameters.Count > 0)
				options[ruleId] = parameters;
		}

		return options;
	}

	/// <summary>
	/// Reads the first code block under the Configuration heading. Each <c>key = value</c> line there is an option, and the
	/// comment lines above it describe it, with <c>default: X</c> giving its default.
	/// </summary>
	public static IReadOnlyList<RuleParameter> ReadDocument(string ruleId, IReadOnlyList<string> lines)
	{
		var headingIndex = lines.ToList().FindIndex(line => ConfigurationHeadingPattern().IsMatch(line));
		if (headingIndex == -1)
			return [];

		var openingIndex = lines.Skip(headingIndex + 1).ToList().FindIndex(line => line.TrimStart().StartsWith("```", StringComparison.Ordinal));
		if (openingIndex == -1)
			return [];

		var fenceStart = headingIndex + 1 + openingIndex;
		var fence = FencePattern().Match(lines[fenceStart].Trim()).Value;
		var parameters = new List<RuleParameter>();
		var comments = new List<string>();
		foreach (var rawLine in lines.Skip(fenceStart + 1))
		{
			var line = rawLine.Trim();
			if (line.StartsWith(fence, StringComparison.Ordinal))
				break;

			if (line.Length == 0)
			{
				comments.Clear();
			}
			else if (line.StartsWith('#'))
			{
				comments.Add(line.TrimStart('#').Trim());
			}
			else if (line.Contains('=', StringComparison.Ordinal))
			{
				var key = line[..line.IndexOf('=', StringComparison.Ordinal)].Trim();
				if (IsOptionKey(key, ruleId) && parameters.TrueForAll(parameter => parameter.Key != key))
					parameters.Add(ToParameter(key, comments));
				comments.Clear();
			}
		}

		return parameters;
	}

	// Severity keys are rule severities, which the wizard already models.
	private static bool IsOptionKey(string key, string ruleId) =>
		(key.StartsWith($"{ruleId}.", StringComparison.Ordinal) || key.StartsWith($"dotnet_diagnostic.{ruleId}.", StringComparison.Ordinal))
		&& !key.EndsWith(".severity", StringComparison.Ordinal);

	private static RuleParameter ToParameter(string key, IReadOnlyList<string> comments)
	{
		string? defaultValue = null;
		var descriptionParts = new List<string>();
		foreach (var comment in comments.Where(comment => !comment.Equals(".editorconfig file", StringComparison.OrdinalIgnoreCase)))
		{
			var defaultMatch = DefaultPattern().Match(comment);
			if (defaultMatch.Success)
				defaultValue = defaultMatch.Groups["value"].Value.Trim();

			var description = defaultMatch.Success ? comment[..defaultMatch.Index].Trim().TrimEnd('.') : comment;
			if (description.Length > 0)
				descriptionParts.Add(description.EndsWith('.') ? description : $"{description}.");
		}

		if (defaultValue == NoDefault)
			defaultValue = null;
		var type = defaultValue is "true" or "false" ? BooleanType : StringType;
		return new RuleParameter(key, string.Join(' ', descriptionParts), type, defaultValue, IsEditorConfigKey: true);
	}

	[GeneratedRegex(@"^#+\s*Configuration\s*$", RegexOptions.IgnoreCase)]
	private static partial Regex ConfigurationHeadingPattern();

	[GeneratedRegex("^`{3,}")]
	private static partial Regex FencePattern();

	[GeneratedRegex(@"[.,]?\s*default:\s*(?<value>.*)$", RegexOptions.IgnoreCase)]
	private static partial Regex DefaultPattern();
}
