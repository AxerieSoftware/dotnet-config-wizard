namespace CatalogBuilder.Models;

/// <summary>An .editorconfig code-style or formatting option parsed from the dotnet/docs style rules.</summary>
internal sealed record OptionEntry(
	string Name,
	string Group,
	IReadOnlyList<string> Languages,
	IReadOnlyList<OptionValue> Values,
	bool AllowsMultipleValues,
	string? DefaultValue,
	IReadOnlyList<string> RuleIds,
	string? Example,
	string DocFile);

internal sealed record OptionValue(string Value, string Description);
