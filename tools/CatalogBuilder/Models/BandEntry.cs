namespace CatalogBuilder.Models;

/// <summary>One SDK band in the catalog, with the support details the wizard shows next to it.</summary>
internal sealed record BandEntry(
	string Band,
	string SdkVersion,
	string Channel,
	string SupportPhase,
	string ReleaseType,
	string? EndOfLifeDate,
	bool IsPreview);
