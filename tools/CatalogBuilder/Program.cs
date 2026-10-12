using System.Text.Encodings.Web;
using System.Text.Json;
using CatalogBuilder;

var arguments = ParseArguments(args);
if (!arguments.TryGetValue("--sdk", out var sdkDirectory) || !arguments.TryGetValue("--docs", out var docsDirectory) || !arguments.TryGetValue("--out", out var outputDirectory))
{
	Console.Error.WriteLine("Usage: CatalogBuilder --sdk <sdk folder, e.g. /usr/share/dotnet/sdk/10.0.300> --docs <dotnet/docs clone> --out <catalog/generated>");
	return 1;
}

var layout = SdkLayout.Load(sdkDirectory);
var codeStyleResult = AnalyzerReader.Read("Microsoft.CodeAnalysis.CSharp.CodeStyle", layout.CodeStyleAssemblies, layout.ProbeDirectories);
var netAnalyzersResult = AnalyzerReader.Read("Microsoft.CodeAnalysis.NetAnalyzers", layout.NetAnalyzersAssemblies, layout.ProbeDirectories);
var rules = codeStyleResult.Rules.Concat(netAnalyzersResult.Rules).OrderBy(rule => rule.Id, StringComparer.Ordinal).ToList();
var failures = codeStyleResult.Failures.Concat(netAnalyzersResult.Failures).ToList();
foreach (var failure in failures)
	Console.Error.WriteLine(failure);

var analysisLevels = AnalysisLevelReader.Read(layout.AnalysisLevelConfigDirectory);
var sdkCatalog = new CatalogBuilder.Models.SdkCatalog(layout.SdkVersion, layout.Band, rules, analysisLevels);

var styleRulesDirectory = Path.Combine(docsDirectory, "docs", "fundamentals", "code-analysis", "style-rules");
var styleOptionCatalog = DocsOptionReader.Read(styleRulesDirectory);

Directory.CreateDirectory(outputDirectory);
await WriteJsonAsync(Path.Combine(outputDirectory, $"sdk-{layout.Band}.json"), sdkCatalog);
await WriteJsonAsync(Path.Combine(outputDirectory, "style-options.json"), styleOptionCatalog);

Console.WriteLine($"Wrote {rules.Count} rules from SDK {layout.SdkVersion} and {styleOptionCatalog.Options.Count} style options.");
return failures.Count == 0 ? 0 : 2;

static Dictionary<string, string> ParseArguments(string[] args)
{
	var arguments = new Dictionary<string, string>(StringComparer.Ordinal);
	for (var index = 0; index + 1 < args.Length; index += 2)
		arguments[args[index]] = args[index + 1];
	return arguments;
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
