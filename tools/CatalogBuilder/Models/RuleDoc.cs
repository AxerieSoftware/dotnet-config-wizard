namespace CatalogBuilder.Models;

/// <summary>A style rule's property table from dotnet/docs, used to group options and map them to rule IDs.</summary>
internal sealed record RuleDoc(
	string Id,
	string Title,
	string Category,
	string? Subcategory,
	IReadOnlyList<string> Languages,
	IReadOnlyList<string> OptionNames,
	string DocFile);
