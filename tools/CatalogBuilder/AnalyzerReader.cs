using System.Collections;
using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using System.Text.RegularExpressions;
using CatalogBuilder.Models;

namespace CatalogBuilder;

internal sealed record AnalyzerReadResult(IReadOnlyList<RuleEntry> Rules, IReadOnlyList<string> Failures);

/// <summary>
/// Reads every C# diagnostic an analyzer assembly reports. Roslyn types are reached through reflection because each
/// assembly is loaded against its own SDK's Roslyn, which this tool doesn't reference.
/// </summary>
internal static partial class AnalyzerReader
{
	private const string DiagnosticAnalyzerTypeName = "Microsoft.CodeAnalysis.Diagnostics.DiagnosticAnalyzer";
	private const string DiagnosticAnalyzerAttributeName = "Microsoft.CodeAnalysis.Diagnostics.DiagnosticAnalyzerAttribute";
	private const string CSharpLanguageName = "C#";
	private const string NotConfigurableTag = "NotConfigurable";

	public static AnalyzerReadResult Read(IReadOnlyList<string> assemblyPaths, IReadOnlyList<string> probeDirectories)
	{
		var loadContext = new AnalyzerLoadContext(probeDirectories);
		var rulesById = new Dictionary<string, RuleEntry>(StringComparer.Ordinal);
		var failures = new List<string>();

		foreach (var assemblyPath in assemblyPaths)
		{
			var assembly = loadContext.LoadFromAssemblyPath(assemblyPath);
			foreach (var analyzerType in GetLoadableTypes(assembly, failures).Where(IsCSharpAnalyzer))
			{
				if (!TryCreateAnalyzer(analyzerType, failures, out var analyzer))
					continue;

				foreach (var descriptor in (IEnumerable)GetProperty(analyzer, "SupportedDiagnostics"))
				{
					var rule = ToRuleEntry(descriptor);
					if (IsConfigurable(rule))
						rulesById.TryAdd(rule.Id, rule);
				}
			}
		}

		loadContext.Unload();

		var rules = rulesById.Values.OrderBy(rule => rule.Id, StringComparer.Ordinal).ToList();
		return new AnalyzerReadResult(rules, failures);
	}

	private static IEnumerable<Type> GetLoadableTypes(Assembly assembly, List<string> failures)
	{
		try
		{
			return assembly.GetTypes();
		}
		catch (ReflectionTypeLoadException exception)
		{
			failures.Add($"Some types in '{assembly.GetName().Name}' couldn't be loaded: {exception.LoaderExceptions.FirstOrDefault()?.Message}");
			return exception.Types.OfType<Type>();
		}
	}

	private static bool IsCSharpAnalyzer(Type type)
	{
		if (type.IsAbstract || !DerivesFrom(type, DiagnosticAnalyzerTypeName))
			return false;

		var attribute = type.CustomAttributes.FirstOrDefault(data => data.AttributeType.FullName == DiagnosticAnalyzerAttributeName);
		if (attribute is null)
			return false;

		var firstLanguage = (string?)attribute.ConstructorArguments[0].Value;
		var additionalLanguages = attribute.ConstructorArguments.Count > 1
			? ((IEnumerable<CustomAttributeTypedArgument>)attribute.ConstructorArguments[1].Value!).Select(argument => (string?)argument.Value)
			: [];
		return firstLanguage == CSharpLanguageName || additionalLanguages.Contains(CSharpLanguageName);
	}

	/// <summary>Skips IDE-internal diagnostics such as <c>IDE0005_gen</c> that can't be set in .editorconfig.</summary>
	private static bool IsConfigurable(RuleEntry rule) => RuleIdPattern().IsMatch(rule.Id) && !rule.Tags.Contains(NotConfigurableTag);

	private static bool DerivesFrom(Type type, string baseTypeName)
	{
		for (var current = type.BaseType; current is not null; current = current.BaseType)
		{
			if (current.FullName == baseTypeName)
				return true;
		}

		return false;
	}

	private static bool TryCreateAnalyzer(Type analyzerType, List<string> failures, [NotNullWhen(true)] out object? analyzer)
	{
		try
		{
			analyzer = Activator.CreateInstance(analyzerType);
			return analyzer is not null;
		}
		catch (Exception exception)
		{
			failures.Add($"Analyzer '{analyzerType.FullName}' couldn't be created: {exception.GetBaseException().Message}");
			analyzer = null;
			return false;
		}
	}

	private static RuleEntry ToRuleEntry(object descriptor)
	{
		var helpLink = (string?)GetProperty(descriptor, "HelpLinkUri");
		var description = GetProperty(descriptor, "Description").ToString();

		return new RuleEntry(
			(string)GetProperty(descriptor, "Id"),
			GetProperty(descriptor, "Title").ToString()!,
			(string)GetProperty(descriptor, "Category"),
			ToEditorConfigSeverity(GetProperty(descriptor, "DefaultSeverity").ToString()!),
			(bool)GetProperty(descriptor, "IsEnabledByDefault"),
			string.IsNullOrEmpty(helpLink) ? null : helpLink,
			string.IsNullOrEmpty(description) ? null : description,
			((IEnumerable<string>)GetProperty(descriptor, "CustomTags")).ToList());
	}

	private static object GetProperty(object instance, string propertyName)
	{
		var property = instance.GetType().GetProperty(propertyName)
			?? throw new InvalidOperationException($"Type '{instance.GetType().FullName}' has no '{propertyName}' property.");
		return property.GetValue(instance)!;
	}

	[GeneratedRegex("^[A-Z]+[0-9]+$")]
	private static partial Regex RuleIdPattern();

	private static string ToEditorConfigSeverity(string diagnosticSeverity) => diagnosticSeverity switch
	{
		"Hidden" => "silent",
		"Info" => "suggestion",
		"Warning" => "warning",
		"Error" => "error",
		_ => throw new InvalidOperationException($"Diagnostic severity '{diagnosticSeverity}' has no .editorconfig equivalent.")
	};
}
