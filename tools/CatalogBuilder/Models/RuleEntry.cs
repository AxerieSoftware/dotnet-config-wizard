namespace CatalogBuilder.Models;

/// <summary>
/// A diagnostic as its analyzer reports it, with severities in .editorconfig vocabulary. <c>Source</c> names the analyzer
/// package or SDK component it ships in, which output uses to group severities.
/// </summary>
internal sealed record RuleEntry(
	string Id,
	string Source,
	string Title,
	string Category,
	string DefaultSeverity,
	bool IsEnabledByDefault,
	string? HelpLink,
	string? Description,
	IReadOnlyList<string> Tags);
