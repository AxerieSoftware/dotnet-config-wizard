using System.Text.RegularExpressions;
using CatalogBuilder.Models;

namespace CatalogBuilder;

/// <summary>
/// Parses the property tables in dotnet/docs <c>docs/fundamentals/code-analysis/style-rules</c>: rule tables give IDs, titles and
/// groups, and option tables give names, allowed values, defaults and the C# example that follows them.
/// </summary>
internal static partial class DocsOptionReader
{
	private const string FormattingRuleId = "IDE0055";
	private const string FormattingDocSuffix = "-formatting-options.md";
	private const string FallbackGroup = "Other";

	public static StyleOptionCatalog Read(string styleRulesDirectory)
	{
		var documents = Directory.GetFiles(styleRulesDirectory, "*.md")
			.Order(StringComparer.Ordinal)
			.Select(path => ReadDocument(Path.GetFileName(path), File.ReadAllLines(path)))
			.ToList();

		var rules = documents.SelectMany(document => document.Rules).ToList();
		var options = documents
			.SelectMany(document => document.Options)
			.GroupBy(option => option.Name, StringComparer.Ordinal)
			.Select(group => WithRuleMapping(group.First(), rules))
			.OrderBy(option => option.Name, StringComparer.Ordinal)
			.ToList();

		return new StyleOptionCatalog(options, rules);
	}

	public static (IReadOnlyList<RuleDoc> Rules, IReadOnlyList<OptionEntry> Options) ReadDocument(string fileName, IReadOnlyList<string> lines)
	{
		var tables = ReadTables(lines);
		var rules = tables
			.Where(table => table.Has("Rule ID"))
			.SelectMany(ToRuleDocs)
			.ToList();

		var fileLanguages = rules.Count > 0 ? rules[0].Languages : [];
		var options = tables
			.Where(table => table.Has("Option name"))
			.Select(table => ToOptionEntry(table, lines, fileName, fileLanguages))
			.ToList();

		return (rules, options);
	}

	private static OptionEntry WithRuleMapping(OptionEntry option, IReadOnlyList<RuleDoc> rules)
	{
		var mappedRules = rules.Where(rule => rule.OptionNames.Contains(option.Name)).ToList();
		var ruleIds = mappedRules.Select(rule => rule.Id).Distinct().Order(StringComparer.Ordinal).ToList();

		// The formatting pages document IDE0055's options without a rule table of their own.
		if (ruleIds.Count == 0 && option.DocFile.EndsWith(FormattingDocSuffix, StringComparison.Ordinal))
			ruleIds = [FormattingRuleId];

		var group = mappedRules.FirstOrDefault()?.Subcategory ?? option.Group;
		return option with { RuleIds = ruleIds, Group = group };
	}

	/// <summary>One table can document several IDs, such as <c>IDE0390, IDE0391</c>. Tables that describe the table format itself have none.</summary>
	private static IEnumerable<RuleDoc> ToRuleDocs(MarkdownTable table) => RuleIdPattern()
		.Matches(table.Value("Rule ID"))
		.Select(match => new RuleDoc(
			match.Value,
			table.Value("Title"),
			table.Value("Category"),
			table.Has("Subcategory") ? table.Value("Subcategory") : null,
			ToLanguages(table.Value("Applicable languages")),
			table.Values("Options").SelectMany(Codes).ToList()));

	private static OptionEntry ToOptionEntry(MarkdownTable table, IReadOnlyList<string> lines, string fileName, IReadOnlyList<string> fileLanguages)
	{
		var valueRows = table.RowsLabeled("Option values");
		var values = valueRows
			.SelectMany(row => Codes(row.Value).Select(value => new OptionValue(value, row.Description)))
			.ToList();

		return new OptionEntry(
			FirstCode(table.Value("Option name")) ?? table.Value("Option name"),
			table.Section ?? FallbackGroup,
			table.Has("Applicable languages") ? ToLanguages(table.Value("Applicable languages")) : fileLanguages,
			values,
			valueRows.Any(row => Codes(row.Value).Count > 1),
			ToDefaultValue(table),
			[],
			FindCSharpExample(lines, table.EndLine),
			fileName);
	}

	private static string? ToDefaultValue(MarkdownTable table)
	{
		if (!table.Has("Default option value"))
			return null;

		// Some defaults still carry the legacy ":severity" suffix, which belongs to the rule, not the option.
		var defaultValue = FirstCode(table.Value("Default option value"));
		return defaultValue?.Split(':')[0];
	}

	private static List<string> ToLanguages(string cell)
	{
		var languages = new List<string>();
		if (cell.Contains("C#", StringComparison.Ordinal))
			languages.Add("csharp");
		if (cell.Contains("Visual Basic", StringComparison.Ordinal))
			languages.Add("visualbasic");
		return languages;
	}

	/// <summary>Returns the first <c>```csharp</c> block after a table, stopping at the next heading.</summary>
	private static string? FindCSharpExample(IReadOnlyList<string> lines, int startLine)
	{
		for (var index = startLine; index < lines.Count; index++)
		{
			var line = lines[index];
			if (line.StartsWith('#'))
				return null;
			if (line.Trim() != "```csharp")
				continue;

			var codeLines = lines.Skip(index + 1).TakeWhile(codeLine => codeLine.Trim() != "```");
			return string.Join('\n', codeLines);
		}

		return null;
	}

	private static List<MarkdownTable> ReadTables(IReadOnlyList<string> lines)
	{
		var tables = new List<MarkdownTable>();
		string? section = null;
		var index = 0;

		while (index < lines.Count)
		{
			var line = lines[index];
			if (line.StartsWith("## ", StringComparison.Ordinal))
				section = line[3..].Trim();

			if (!line.StartsWith('|'))
			{
				index++;
				continue;
			}

			var tableLines = lines.Skip(index).TakeWhile(tableLine => tableLine.StartsWith('|')).ToList();
			index += tableLines.Count;
			tables.Add(new MarkdownTable(ToRows(tableLines), section, index));
		}

		return tables;
	}

	/// <summary>Turns table lines into rows, giving continuation rows (blank label) the label of the row above.</summary>
	private static List<TableRow> ToRows(IReadOnlyList<string> tableLines)
	{
		var rows = new List<TableRow>();
		var label = "";

		foreach (var line in tableLines)
		{
			var cells = line.Trim().Trim('|').Split('|').Select(cell => cell.Trim()).ToList();
			if (cells.All(cell => SeparatorPattern().IsMatch(cell)))
				continue;

			var cellLabel = cells[0].Replace("**", "", StringComparison.Ordinal).Trim();
			if (cellLabel.Length > 0)
				label = cellLabel;

			rows.Add(new TableRow(label, cells.Count > 1 ? cells[1] : "", cells.Count > 2 ? cells[2] : ""));
		}

		return rows;
	}

	private static string? FirstCode(string cell)
	{
		var codes = Codes(cell);
		return codes.Count > 0 ? codes[0] : null;
	}

	private static List<string> Codes(string cell) => CodePattern().Matches(cell).Select(match => match.Groups[1].Value).ToList();

	[GeneratedRegex("`([^`]+)`")]
	private static partial Regex CodePattern();

	[GeneratedRegex(@"\bIDE\d{4}\b")]
	private static partial Regex RuleIdPattern();

	[GeneratedRegex("^:?-+:?$")]
	private static partial Regex SeparatorPattern();

	private sealed record TableRow(string Label, string Value, string Description);

	private sealed record MarkdownTable(IReadOnlyList<TableRow> Rows, string? Section, int EndLine)
	{
		public bool Has(string label) => this.Rows.Any(row => row.Label == label);

		public List<TableRow> RowsLabeled(string label) => this.Rows.Where(row => row.Label == label).ToList();

		public List<string> Values(string label) => this.RowsLabeled(label).Select(row => row.Value).ToList();

		public string Value(string label) => this.RowsLabeled(label)[0].Value;
	}
}
