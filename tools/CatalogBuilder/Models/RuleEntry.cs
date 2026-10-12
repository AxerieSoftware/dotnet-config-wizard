namespace CatalogBuilder.Models;

/// <summary>
/// A diagnostic as its analyzer or the compiler reports it, with severities in .editorconfig vocabulary. <c>Source</c>
/// names the package or SDK component it ships in, which output uses to group severities. <c>WarningLevel</c> is set for
/// compiler warnings only, and <c>Parameters</c> for rules with settings outside .editorconfig, such as Sonar's.
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
	IReadOnlyList<string> Tags,
	bool HasCodeFix,
	int? WarningLevel,
	IReadOnlyList<RuleParameter> Parameters);

/// <summary>A setting a rule reads from an additional file, such as Sonar's maximum parameter count for S107.</summary>
internal sealed record RuleParameter(string Key, string Description, string Type, string? DefaultValue);
