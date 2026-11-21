namespace CatalogBuilder.Models;

/// <summary>One entry of the hand-maintained <c>catalog/packages.json</c>: an analyzer package the wizard offers.</summary>
/// <remarks>
/// <c>RepublishDescriptions</c> is false for packages whose license doesn't allow copying their rule text.
/// <c>IncludedWith</c> names the package or SDK that already brings the analyzers in, such as xunit.v3, so projects never reference them directly.
/// <c>RuleOptionDocs</c> is set for packages whose rule pages document .editorconfig options the assemblies don't list.
/// </remarks>
internal sealed record TrackedPackage(string Id, string Title, bool RepublishDescriptions, string? IncludedWith, RuleOptionDocs? RuleOptionDocs);

/// <summary>A GitHub repo, tagged with each package version, and the folder in it holding one Markdown page per rule.</summary>
internal sealed record RuleOptionDocs(string Repository, string Path);

/// <summary>An analyzer package's rules at the version the catalog read.</summary>
internal sealed record PackageCatalog(string Id, string Version, IReadOnlyList<RuleEntry> Rules);

/// <summary>
/// Support details for an analyzer package. <c>Version</c> is the newest stable release, or the newest prerelease when no
/// stable release is under 18 months old. <c>LatestVersion</c> includes prereleases, so a package that only ships betas
/// still counts as maintained; <c>IsStale</c> means its newest version is over 18 months old.
/// </summary>
internal sealed record PackageEntry(
	string Id,
	string Title,
	string? IncludedWith,
	string Version,
	string LatestVersion,
	string LatestPublished,
	bool IsDeprecated,
	bool IsStale,
	int RuleCount);
