namespace CatalogBuilder.Models;

/// <summary>
/// An .editorconfig code-style or formatting option parsed from the dotnet/docs style rules. <c>MinimumCSharpVersion</c> is set
/// only when every rule the option feeds needs a newer language version.
/// </summary>
internal sealed record OptionEntry(
	string Name,
	string Group,
	IReadOnlyList<string> Languages,
	string? MinimumCSharpVersion,
	IReadOnlyList<OptionValue> Values,
	bool AllowsMultipleValues,
	string? DefaultValue,
	IReadOnlyList<string> RuleIds,
	string? Example,
	string DocFile);

internal sealed record OptionValue(string Value, string Description);
