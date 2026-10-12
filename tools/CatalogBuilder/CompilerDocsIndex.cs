using System.Text.RegularExpressions;

namespace CatalogBuilder;

/// <summary>
/// Maps compiler diagnostic IDs to their dotnet/docs pages using each page's <c>f1_keywords</c>, since one page often
/// documents many IDs and there's no URL pattern to derive them from.
/// </summary>
internal static partial class CompilerDocsIndex
{
	private static readonly (string RelativeDirectory, string UrlBase)[] DocsFolders =
	[
		("docs/csharp/language-reference/compiler-messages", "https://learn.microsoft.com/dotnet/csharp/language-reference/compiler-messages"),
		("docs/csharp/misc", "https://learn.microsoft.com/dotnet/csharp/misc")
	];

	public static IReadOnlyDictionary<string, string> Read(string docsDirectory)
	{
		var helpLinks = new Dictionary<string, string>(StringComparer.Ordinal);
		foreach (var (relativeDirectory, urlBase) in DocsFolders)
		{
			foreach (var path in Directory.GetFiles(Path.Combine(docsDirectory, relativeDirectory), "*.md").Order(StringComparer.Ordinal))
			{
				var url = $"{urlBase}/{Path.GetFileNameWithoutExtension(path)}";
				foreach (var id in ReadFrontMatterIds(File.ReadLines(path)))
					helpLinks.TryAdd(id, url);
			}
		}

		return helpLinks;
	}

	public static IEnumerable<string> ReadFrontMatterIds(IEnumerable<string> lines)
	{
		var frontMatter = lines.SkipWhile(line => line.Trim() != "---").Skip(1).TakeWhile(line => line.Trim() != "---");
		return frontMatter.Select(line => KeywordPattern().Match(line)).Where(match => match.Success).Select(match => match.Groups["id"].Value);
	}

	[GeneratedRegex("""^\s*-\s*"?(?<id>CS\d{4})"?""")]
	private static partial Regex KeywordPattern();
}
