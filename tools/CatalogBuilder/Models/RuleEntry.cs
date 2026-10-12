namespace CatalogBuilder.Models;

/// <summary>A diagnostic as its analyzer reports it, with severities in .editorconfig vocabulary.</summary>
internal sealed record RuleEntry(
	string Id,
	string Title,
	string Category,
	string DefaultSeverity,
	bool IsEnabledByDefault,
	string? HelpLink,
	string? Description,
	IReadOnlyList<string> Tags);
