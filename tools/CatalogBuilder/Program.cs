using System.Text.Encodings.Web;
using System.Text.Json;
using CatalogBuilder;
using CatalogBuilder.Models;

var arguments = ParseArguments(args);
if (!arguments.TryGetValue("--sdk", out var sdkDirectories) || !TryGetSingle(arguments, "--docs", out var docsDirectory) || !TryGetSingle(arguments, "--releases-index", out var releasesIndexPath) || !TryGetSingle(arguments, "--out", out var outputDirectory))
{
	Console.Error.WriteLine("Usage: CatalogBuilder --sdk <sdk folder, e.g. ~/.dotnet/sdk/10.0.401> [--sdk <another>] --docs <dotnet/docs clone> --releases-index <releases-index.json> --out <catalog/generated>");
	return 1;
}

var channels = ReleasesIndexReader.Read(await File.ReadAllTextAsync(releasesIndexPath));
var failures = new List<string>();
var bands = new List<BandEntry>();
Directory.CreateDirectory(outputDirectory);

foreach (var sdkDirectory in sdkDirectories)
{
	var layout = SdkLayout.Load(sdkDirectory);
	var codeStyleResult = AnalyzerReader.Read("Microsoft.CodeAnalysis.CSharp.CodeStyle", layout.CodeStyleAssemblies, layout.ProbeDirectories);
	var netAnalyzersResult = AnalyzerReader.Read("Microsoft.CodeAnalysis.NetAnalyzers", layout.NetAnalyzersAssemblies, layout.ProbeDirectories);
	var rules = codeStyleResult.Rules.Concat(netAnalyzersResult.Rules).OrderBy(rule => rule.Id, StringComparer.Ordinal).ToList();
	failures.AddRange(codeStyleResult.Failures.Concat(netAnalyzersResult.Failures).Select(failure => $"SDK {layout.SdkVersion}: {failure}"));

	var analysisLevels = AnalysisLevelReader.Read(layout.AnalysisLevelConfigDirectory);
	await WriteJsonAsync(Path.Combine(outputDirectory, $"sdk-{layout.Band}.json"), new SdkCatalog(layout.SdkVersion, layout.Band, rules, analysisLevels));

	var channel = channels[layout.Channel];
	bands.Add(new BandEntry(layout.Band, layout.SdkVersion, channel.Channel, channel.SupportPhase, channel.ReleaseType, channel.EndOfLifeDate, ReleasesIndexReader.IsPreview(channel)));
	Console.WriteLine($"Wrote {rules.Count} rules from SDK {layout.SdkVersion}.");
}

var styleRulesDirectory = Path.Combine(docsDirectory, "docs", "fundamentals", "code-analysis", "style-rules");
var styleOptionCatalog = DocsOptionReader.Read(styleRulesDirectory);
await WriteJsonAsync(Path.Combine(outputDirectory, "style-options.json"), styleOptionCatalog);
await WriteJsonAsync(Path.Combine(outputDirectory, "bands.json"), bands.OrderByDescending(band => Version.Parse(band.Channel)).ToList());
Console.WriteLine($"Wrote {styleOptionCatalog.Options.Count} style options and {bands.Count} bands.");

foreach (var failure in failures)
	Console.Error.WriteLine(failure);

return failures.Count == 0 ? 0 : 2;

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
