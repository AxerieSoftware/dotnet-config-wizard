using System.Globalization;
using System.Net;
using System.Reflection;
using System.Text.Encodings.Web;
using System.Text.Json;
using CatalogBuilder;
using CatalogBuilder.Models;

const string ILLinkPackageId = "Microsoft.NET.ILLink.Tasks";
const string AspNetCorePackId = "Microsoft.AspNetCore.App.Ref";
const int StaleAfterMonths = 18;

var arguments = ParseArguments(args);
if (!arguments.TryGetValue("--sdk", out var sdkDirectories)
	|| !TryGetSingle(arguments, "--docs", out var docsDirectory)
	|| !TryGetSingle(arguments, "--releases-index", out var releasesIndexPath)
	|| !TryGetSingle(arguments, "--packages", out var packagesPath)
	|| !TryGetSingle(arguments, "--cache", out var cacheDirectory)
	|| !TryGetSingle(arguments, "--out", out var outputDirectory))
{
	Console.Error.WriteLine("Usage: CatalogBuilder --sdk <sdk folder> [--sdk <another>] --docs <dotnet/docs clone> --releases-index <releases-index.json> --packages <catalog/packages.json> --cache <folder> --out <catalog/generated>");
	return 1;
}

using var httpClient = new HttpClient(new HttpClientHandler { AutomaticDecompression = DecompressionMethods.All });
var nuGetClient = new NuGetClient(httpClient, Path.Combine(cacheDirectory, "nuget"));
var channels = ReleasesIndexReader.Read(await File.ReadAllTextAsync(releasesIndexPath));
var compilerHelpLinks = CompilerDocsIndex.Read(docsDirectory);
var failures = new List<string>();
var catalogedRuleIds = new HashSet<string>(StringComparer.Ordinal);
var notes = new List<string>();
var bands = new List<BandEntry>();
Directory.CreateDirectory(outputDirectory);

var layouts = sdkDirectories.Select(SdkLayout.Load).ToList();
foreach (var layout in layouts)
{
	var channel = channels[layout.Channel];
	var ilLinkDirectory = await nuGetClient.ExtractAsync(ILLinkPackageId, channel.LatestRuntime);
	var ilLinkAssemblies = PackageAnalyzerLocator.Find(ilLinkDirectory, GetRoslynVersion(layout));
	var aspNetCoreAssemblies = layout.GetAspNetCoreAnalyzerAssemblies(channel.LatestRuntime);

	var results = new[]
	{
		AnalyzerReader.Read("Microsoft.CodeAnalysis.CSharp.CodeStyle", layout.CodeStyleAssemblies, layout.ProbeDirectories),
		AnalyzerReader.Read("Microsoft.CodeAnalysis.NetAnalyzers", layout.NetAnalyzersAssemblies, layout.ProbeDirectories),
		AnalyzerReader.Read(ILLinkPackageId, ilLinkAssemblies, [Path.GetDirectoryName(ilLinkAssemblies[0])!, .. layout.ProbeDirectories]),
		AnalyzerReader.Read(AspNetCorePackId, aspNetCoreAssemblies, [Path.GetDirectoryName(aspNetCoreAssemblies[0])!, .. layout.ProbeDirectories])
	};
	var rules = results
		.SelectMany(result => result.Rules)
		.Concat(CompilerWarningReader.Read(layout.RoslynDirectory, compilerHelpLinks))
		.OrderBy(rule => rule.Id, StringComparer.Ordinal)
		.ToList();
	failures.AddRange(results.SelectMany(result => result.Failures).Select(failure => $"SDK {layout.SdkVersion}: {failure}"));
	notes.AddRange(results.SelectMany(result => result.Notes).Select(note => $"SDK {layout.SdkVersion}: {note}"));

	catalogedRuleIds.UnionWith(rules.Select(rule => rule.Id));
	var analysisLevels = AnalysisLevelReader.Read(layout.AnalysisLevelConfigDirectory);
	await WriteJsonAsync(Path.Combine(outputDirectory, $"sdk-{layout.Band}.json"), new SdkCatalog(layout.SdkVersion, layout.Band, rules, analysisLevels));
	bands.Add(new BandEntry(layout.Band, layout.SdkVersion, channel.Channel, channel.SupportPhase, channel.ReleaseType, channel.EndOfLifeDate, ReleasesIndexReader.IsPreview(channel)));
	Console.WriteLine($"Wrote {rules.Count} rules from SDK {layout.SdkVersion}.");
}

// Packages don't vary by SDK, so they're read once against the newest supported release's Roslyn.
var hostLayout = layouts
	.Where(layout => !ReleasesIndexReader.IsPreview(channels[layout.Channel]))
	.MaxBy(layout => Version.Parse(layout.Channel))!;
var trackedPackages = JsonSerializer.Deserialize<List<TrackedPackage>>(await File.ReadAllTextAsync(packagesPath), new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
var packageEntries = new List<PackageEntry>();
var staleBefore = DateTimeOffset.UtcNow.AddMonths(-StaleAfterMonths);
foreach (var trackedPackage in trackedPackages)
{
	var versions = await nuGetClient.GetVersionsAsync(trackedPackage.Id);
	var latestInfo = await nuGetClient.GetVersionInfoAsync(trackedPackage.Id, versions[^1]);
	var stableVersion = versions.LastOrDefault(version => !version.Contains('-', StringComparison.Ordinal));
	var stableInfo = stableVersion is null || stableVersion == latestInfo.Version ? latestInfo : await nuGetClient.GetVersionInfoAsync(trackedPackage.Id, stableVersion);
	// A package that only ships prereleases, such as ErrorProne.NET, is read at its newest prerelease.
	var catalogedInfo = stableInfo.Published < staleBefore ? latestInfo : stableInfo;
	var catalogedVersion = catalogedInfo.Version;

	var packageDirectory = await nuGetClient.ExtractAsync(trackedPackage.Id, catalogedVersion);
	var assemblies = PackageAnalyzerLocator.Find(packageDirectory, GetRoslynVersion(hostLayout));
	var probeDirectories = assemblies.Select(Path.GetDirectoryName).Distinct().Concat(hostLayout.ProbeDirectories).ToList();
	var result = AnalyzerReader.Read(trackedPackage.Id, assemblies, probeDirectories!, trackedPackage.RepublishDescriptions);
	failures.AddRange(result.Failures.Select(failure => $"{trackedPackage.Id} {catalogedVersion}: {failure}"));
	notes.AddRange(result.Notes.Select(note => $"{trackedPackage.Id} {catalogedVersion}: {note}"));

	catalogedRuleIds.UnionWith(result.Rules.Select(rule => rule.Id));
	await WriteJsonAsync(Path.Combine(outputDirectory, $"package-{trackedPackage.Id.ToLowerInvariant()}.json"), new PackageCatalog(trackedPackage.Id, catalogedVersion, result.Rules));

	var isStale = latestInfo.Published < staleBefore;
	var isDeprecated = catalogedInfo.IsDeprecated || latestInfo.IsDeprecated;
	packageEntries.Add(new PackageEntry(trackedPackage.Id, trackedPackage.Title, trackedPackage.IncludedWith, catalogedVersion, latestInfo.Version, latestInfo.Published.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), isDeprecated, isStale, result.Rules.Count));
	if (isStale || isDeprecated)
		Console.Error.WriteLine($"{trackedPackage.Id} fails the maintenance gate: last published {latestInfo.Published:yyyy-MM-dd}{(isDeprecated ? ", deprecated" : "")}.");

	Console.WriteLine($"Wrote {result.Rules.Count} rules from {trackedPackage.Id} {catalogedVersion}.");
}

var styleRulesDirectory = Path.Combine(docsDirectory, "docs", "fundamentals", "code-analysis", "style-rules");
var styleOptionCatalog = DocsOptionReader.Read(styleRulesDirectory);
await WriteJsonAsync(Path.Combine(outputDirectory, "style-options.json"), styleOptionCatalog);
await WriteJsonAsync(Path.Combine(outputDirectory, "bands.json"), bands.OrderByDescending(band => Version.Parse(band.Channel)).ToList());
await WriteJsonAsync(Path.Combine(outputDirectory, "packages.json"), packageEntries);

var historyPath = Path.Combine(outputDirectory, "rule-history.json");
var existingHistory = File.Exists(historyPath) ? await File.ReadAllTextAsync(historyPath) : null;
await WriteJsonAsync(historyPath, RuleHistory.Update(existingHistory, catalogedRuleIds, DateOnly.FromDateTime(DateTime.UtcNow)));
Console.WriteLine($"Wrote {styleOptionCatalog.Options.Count} style options, {bands.Count} bands and {packageEntries.Count} packages.");

foreach (var note in notes)
	Console.WriteLine($"Note: {note}");
foreach (var failure in failures)
	Console.Error.WriteLine(failure);

return failures.Count == 0 ? 0 : 2;

static Version GetRoslynVersion(SdkLayout layout) => AssemblyName.GetAssemblyName(Path.Combine(layout.RoslynDirectory, "Microsoft.CodeAnalysis.dll")).Version!;

static Dictionary<string, List<string>> ParseArguments(string[] args)
{
	var arguments = new Dictionary<string, List<string>>(StringComparer.Ordinal);
	for (var index = 0; index + 1 < args.Length; index += 2)
	{
		if (!arguments.TryGetValue(args[index], out var values))
		{
			values = [];
			arguments[args[index]] = values;
		}

		values.Add(args[index + 1]);
	}

	return arguments;
}

static bool TryGetSingle(Dictionary<string, List<string>> arguments, string name, out string value)
{
	var hasSingle = arguments.TryGetValue(name, out var values) && values.Count == 1;
	value = hasSingle ? values![0] : "";
	return hasSingle;
}

static async Task WriteJsonAsync<TValue>(string path, TValue value)
{
	var serializerOptions = new JsonSerializerOptions
	{
		PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
		WriteIndented = true,
		IndentCharacter = '\t',
		IndentSize = 1,
		NewLine = "\n",
		Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
	};

	await using var stream = File.Create(path);
	await JsonSerializer.SerializeAsync(stream, value, serializerOptions);
	await stream.WriteAsync("\n"u8.ToArray());
}
