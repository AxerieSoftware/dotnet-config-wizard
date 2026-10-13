using System.Collections;
using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text.RegularExpressions;
using CatalogBuilder.Models;

namespace CatalogBuilder;

/// <summary>Rules read, failures that may have hidden rules, and notes about types that can't hold any.</summary>
internal sealed record AnalyzerReadResult(IReadOnlyList<RuleEntry> Rules, IReadOnlyList<string> Failures, IReadOnlyList<string> Notes);

/// <summary>
/// Reads every C# diagnostic an analyzer assembly reports, which of them have a code fix, and any rule parameters. Roslyn
/// types are reached through reflection because each assembly is loaded against an SDK's own Roslyn, which this tool
/// doesn't reference.
/// </summary>
internal static partial class AnalyzerReader
{
	private const string DiagnosticAnalyzerTypeName = "Microsoft.CodeAnalysis.Diagnostics.DiagnosticAnalyzer";
	private const string DiagnosticAnalyzerAttributeName = "Microsoft.CodeAnalysis.Diagnostics.DiagnosticAnalyzerAttribute";
	private const string CodeFixProviderTypeName = "Microsoft.CodeAnalysis.CodeFixes.CodeFixProvider";
	private const string RuleParameterAttributeName = "RuleParameterAttribute";
	private const string CSharpLanguageName = "C#";
	private const string NotConfigurableTag = "NotConfigurable";

	/// <summary>Reads the given assemblies. <c>includeDescriptions</c> is false for packages whose license doesn't allow republishing their rule text.</summary>
	public static AnalyzerReadResult Read(string source, IReadOnlyList<string> assemblyPaths, IReadOnlyList<string> probeDirectories, bool includeDescriptions = true)
	{
		var loadContext = new AnalyzerLoadContext(probeDirectories);
		var failures = new List<string>();
		var notes = new List<string>();
		var types = assemblyPaths
			.Select(loadContext.LoadFromAssemblyPath)
			.SelectMany(assembly => GetLoadableTypes(assembly, failures, notes))
			.Where(type => !type.IsAbstract)
			.ToList();

		var fixableIds = types
			.Where(type => DerivesFrom(type, CodeFixProviderTypeName))
			.SelectMany(type => GetFixableIds(type, failures))
			.ToHashSet(StringComparer.Ordinal);

		var rulesById = new Dictionary<string, RuleEntry>(StringComparer.Ordinal);
		foreach (var analyzerType in types.Where(IsCSharpAnalyzer))
		{
			if (!TryCreate(analyzerType, failures, out var analyzer))
				continue;

			var parameters = GetRuleParameters(analyzerType);
			foreach (var descriptor in (IEnumerable)GetProperty(analyzer, "SupportedDiagnostics"))
			{
				var rule = ToRuleEntry(source, descriptor, fixableIds, parameters, includeDescriptions);
				if (IsConfigurable(rule))
					rulesById.TryAdd(rule.Id, rule);
			}
		}

		loadContext.Unload();

		var rules = rulesById.Values.OrderBy(rule => rule.Id, StringComparer.Ordinal).ToList();
		return new AnalyzerReadResult(rules, failures, notes);
	}

	/// <summary>
	/// Packages often embed Roslyn helper types built against another Roslyn version. Those failing to load is a note;
	/// a type that looks like an analyzer or code fix failing is a failure, since its rules would go missing.
	/// </summary>
	private static IEnumerable<Type> GetLoadableTypes(Assembly assembly, List<string> failures, List<string> notes)
	{
		try
		{
			return assembly.GetTypes();
		}
		catch (ReflectionTypeLoadException exception)
		{
			foreach (var loaderException in exception.LoaderExceptions.OfType<TypeLoadException>().DistinctBy(loaderException => loaderException.TypeName))
			{
				var message = $"Type '{loaderException.TypeName}' in '{assembly.GetName().Name}' couldn't be loaded: {loaderException.Message}";
				if (AnalyzerTypeNamePattern().IsMatch(loaderException.TypeName))
					failures.Add(message);
				else
					notes.Add(message);
			}

			var loadedTypes = exception.Types.OfType<Type>().ToList();
			var otherException = exception.LoaderExceptions.FirstOrDefault(loaderException => loaderException is not TypeLoadException);
			if (otherException is not null)
			{
				// A missing dependency doesn't name the types it broke, so compare analyzer-like type names with what loaded.
				// ASP.NET Core's editor features, for example, need a Roslyn assembly only Visual Studio ships.
				var missingAnalyzerTypes = GetDefinedTypeNames(assembly.Location)
					.Where(name => AnalyzerTypeNamePattern().IsMatch(name))
					.Except(loadedTypes.Select(type => type.FullName!), StringComparer.Ordinal)
					.ToList();
				var message = $"Some types in '{assembly.GetName().Name}' couldn't be loaded: {otherException.Message}";
				if (missingAnalyzerTypes.Count > 0)
					failures.Add($"{message} Analyzer types affected: {string.Join(", ", missingAnalyzerTypes)}.");
				else
					notes.Add(message);
			}

			return loadedTypes;
		}
	}

	private static List<string> GetDefinedTypeNames(string assemblyPath)
	{
		using var stream = File.OpenRead(assemblyPath);
		using var peReader = new PEReader(stream);
		var metadataReader = peReader.GetMetadataReader();
		return metadataReader.TypeDefinitions
			.Select(metadataReader.GetTypeDefinition)
			.Select(type => (Namespace: metadataReader.GetString(type.Namespace), Name: metadataReader.GetString(type.Name)))
			.Select(type => type.Namespace.Length == 0 ? type.Name : $"{type.Namespace}.{type.Name}")
			.ToList();
	}

	private static IEnumerable<string> GetFixableIds(Type fixProviderType, List<string> failures)
	{
		if (!TryCreate(fixProviderType, failures, out var fixProvider))
			return [];

		return (IEnumerable<string>)GetProperty(fixProvider, "FixableDiagnosticIds");
	}

	private static bool IsCSharpAnalyzer(Type type)
	{
		if (!DerivesFrom(type, DiagnosticAnalyzerTypeName))
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

	/// <summary>Reads Sonar-style <c>[RuleParameter(key, type, description, default)]</c> attributes on an analyzer's properties.</summary>
	private static List<RuleParameter> GetRuleParameters(Type analyzerType)
	{
		return analyzerType
			.GetProperties()
			.SelectMany(property => property.CustomAttributes)
			.Where(attribute => attribute.AttributeType.Name == RuleParameterAttributeName)
			.Select(attribute => attribute.ConstructorArguments.Select(ToText).ToList())
			.Select(arguments => new RuleParameter(arguments[0]!, arguments.Count > 2 ? arguments[2] ?? "" : "", arguments[1] ?? "", arguments.Count > 3 ? arguments[3] : null))
			.ToList();
	}

	/// <summary>Turns an attribute argument into text, using an enum value's name rather than its number.</summary>
	private static string? ToText(CustomAttributeTypedArgument argument)
	{
		if (argument.ArgumentType.IsEnum && argument.Value is not null)
			return Enum.GetName(argument.ArgumentType, argument.Value);

		return argument.Value?.ToString();
	}

	private static bool DerivesFrom(Type type, string baseTypeName)
	{
		for (var current = type.BaseType; current is not null; current = current.BaseType)
		{
			if (current.FullName == baseTypeName)
				return true;
		}

		return false;
	}

	private static bool TryCreate(Type type, List<string> failures, [NotNullWhen(true)] out object? instance)
	{
		try
		{
			instance = Activator.CreateInstance(type);
			return instance is not null;
		}
		catch (Exception exception)
		{
			failures.Add($"'{type.FullName}' couldn't be created: {exception.GetBaseException().Message}");
			instance = null;
			return false;
		}
	}

	private static RuleEntry ToRuleEntry(string source, object descriptor, HashSet<string> fixableIds, List<RuleParameter> parameters, bool includeDescriptions)
	{
		var id = (string)GetProperty(descriptor, "Id");
		var helpLink = (string?)GetProperty(descriptor, "HelpLinkUri");
		var description = includeDescriptions ? GetProperty(descriptor, "Description").ToString() : null;

		return new RuleEntry(
			id,
			source,
			GetProperty(descriptor, "Title").ToString()!,
			(string)GetProperty(descriptor, "Category"),
			ToEditorConfigSeverity(GetProperty(descriptor, "DefaultSeverity").ToString()!),
			(bool)GetProperty(descriptor, "IsEnabledByDefault"),
			string.IsNullOrEmpty(helpLink) ? null : helpLink,
			string.IsNullOrEmpty(description) ? null : description,
			((IEnumerable<string>)GetProperty(descriptor, "CustomTags")).ToList(),
			fixableIds.Contains(id),
			null,
			parameters);
	}

	/// <summary>Skips IDE-internal diagnostics such as <c>IDE0005_gen</c> that can't be set in .editorconfig.</summary>
	private static bool IsConfigurable(RuleEntry rule) => RuleIdPattern().IsMatch(rule.Id) && !rule.Tags.Contains(NotConfigurableTag);

	private static object GetProperty(object instance, string propertyName)
	{
		var property = instance.GetType().GetProperty(propertyName)
			?? throw new InvalidOperationException($"Type '{instance.GetType().FullName}' has no '{propertyName}' property.");
		return property.GetValue(instance)!;
	}

	[GeneratedRegex("^[A-Za-z]+[0-9]+$")]
	private static partial Regex RuleIdPattern();

	[GeneratedRegex("(Analyzer|CodeFixProvider|FixProvider)$")]
	private static partial Regex AnalyzerTypeNamePattern();

	internal static string ToEditorConfigSeverity(string diagnosticSeverity) => diagnosticSeverity switch
	{
		"Hidden" => "silent",
		"Info" => "suggestion",
		"Warning" => "warning",
		"Error" => "error",
		_ => throw new InvalidOperationException($"Diagnostic severity '{diagnosticSeverity}' has no .editorconfig equivalent.")
	};
}
