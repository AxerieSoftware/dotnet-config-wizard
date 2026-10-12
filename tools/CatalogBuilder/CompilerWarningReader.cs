using System.Reflection;
using System.Resources;
using CatalogBuilder.Models;

namespace CatalogBuilder;

/// <summary>
/// Reads every C# compiler warning, which isn't an analyzer and so isn't in <c>SupportedDiagnostics</c>. The IDs come from
/// Roslyn's internal <c>ErrorCode</c> enum, titles from its resources, and warning levels from <c>ErrorFacts</c>, so
/// warning-wave warnings can be told apart.
/// </summary>
internal static class CompilerWarningReader
{
	public const string Source = "Microsoft.CodeAnalysis.CSharp";

	private const string WarningPrefix = "WRN_";
	private const string ErrorCodeTypeName = "Microsoft.CodeAnalysis.CSharp.ErrorCode";
	private const string ErrorFactsTypeName = "Microsoft.CodeAnalysis.CSharp.ErrorFacts";
	private const string ResourcesName = "Microsoft.CodeAnalysis.CSharp.CSharpResources";

	/// <summary>Reads the warnings of the compiler in an SDK's Roslyn folder, linking each to its page in <c>helpLinks</c> when it has one.</summary>
	public static IReadOnlyList<RuleEntry> Read(string roslynDirectory, IReadOnlyDictionary<string, string> helpLinks)
	{
		var loadContext = new AnalyzerLoadContext([roslynDirectory]);
		var compiler = loadContext.LoadFromAssemblyPath(Path.Combine(roslynDirectory, "Microsoft.CodeAnalysis.CSharp.dll"));
		var errorCodeType = compiler.GetType(ErrorCodeTypeName, throwOnError: true)!;
		var getWarningLevel = compiler.GetType(ErrorFactsTypeName, throwOnError: true)!.GetMethod("GetWarningLevel", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic, [errorCodeType])
			?? throw new InvalidOperationException($"{ErrorFactsTypeName}.GetWarningLevel wasn't found. Roslyn changed, so CompilerWarningReader needs updating.");
		var resources = new ResourceManager(ResourcesName, compiler);

		var warnings = Enum.GetValues(errorCodeType)
			.Cast<object>()
			.Where(code => code.ToString()!.StartsWith(WarningPrefix, StringComparison.Ordinal))
			.Select(code => ToRuleEntry(code, (int)getWarningLevel.Invoke(null, [code])!, resources, helpLinks))
			.DistinctBy(rule => rule.Id)
			.OrderBy(rule => rule.Id, StringComparer.Ordinal)
			.ToList();

		loadContext.Unload();
		return warnings;
	}

	private static RuleEntry ToRuleEntry(object code, int warningLevel, ResourceManager resources, IReadOnlyDictionary<string, string> helpLinks)
	{
		var name = code.ToString()!;
		var number = Convert.ToInt32(code, System.Globalization.CultureInfo.InvariantCulture);
		var id = $"CS{number:D4}";
		var title = resources.GetString($"{name}_Title") ?? resources.GetString(name) ?? name;

		return new RuleEntry(
			id,
			Source,
			title,
			ToCategory(name),
			"warning",
			true,
			helpLinks.GetValueOrDefault(id),
			null,
			[],
			false,
			warningLevel,
			[]);
	}

	private static string ToCategory(string name)
	{
		if (name.Contains("Nullab", StringComparison.Ordinal) || name.Contains("Null", StringComparison.Ordinal))
			return "Nullable";
		if (name.Contains("Xml", StringComparison.OrdinalIgnoreCase) || name.Contains("Doc", StringComparison.Ordinal))
			return "Documentation";
		return "Compiler";
	}
}
