namespace CatalogBuilder.Models;

/// <summary>
/// A style rule's property table from dotnet/docs, used to group options and map them to rule IDs. <c>MinimumCSharpVersion</c>
/// comes from an "Applicable languages" cell such as <c>C# 12+</c>.
/// </summary>
internal sealed record RuleDoc(
	string Id,
	string Title,
	string Category,
	string? Subcategory,
	IReadOnlyList<string> Languages,
	string? MinimumCSharpVersion,
	IReadOnlyList<string> OptionNames,
	string DocFile);
