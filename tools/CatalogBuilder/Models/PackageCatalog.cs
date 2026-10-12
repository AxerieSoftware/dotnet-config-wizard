namespace CatalogBuilder.Models;

/// <summary>One entry of the hand-maintained <c>catalog/packages.json</c>: an analyzer package the wizard offers.</summary>
/// <remarks><c>RepublishDescriptions</c> is false for packages whose license doesn't allow copying their rule text.</remarks>
internal sealed record TrackedPackage(string Id, string Title, bool RepublishDescriptions);

/// <summary>An analyzer package's rules at the version the catalog read.</summary>
internal sealed record PackageCatalog(string Id, string Version, IReadOnlyList<RuleEntry> Rules);

/// <summary>
/// Support details for an analyzer package. <c>LatestVersion</c> includes prereleases, so a package that only ships
/// betas still counts as maintained; <c>IsStale</c> means its newest version is over 18 months old.
/// </summary>
internal sealed record PackageEntry(
	string Id,
	string Title,
	string Version,
	string LatestVersion,
	string LatestPublished,
	bool IsDeprecated,
	bool IsStale,
	int RuleCount);
