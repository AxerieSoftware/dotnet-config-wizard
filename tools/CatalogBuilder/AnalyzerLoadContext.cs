using System.Reflection;
using System.Runtime.Loader;

namespace CatalogBuilder;

/// <summary>
/// Loads analyzers next to the Roslyn build that shipped with them, so each SDK band is read with its own compiler
/// instead of whatever Roslyn version this tool happens to reference.
/// </summary>
internal sealed class AnalyzerLoadContext(IReadOnlyList<string> probeDirectories) : AssemblyLoadContext(isCollectible: true)
{
	private readonly IReadOnlyList<string> probeDirectories = probeDirectories ?? throw new ArgumentNullException(nameof(probeDirectories));

	protected override Assembly? Load(AssemblyName assemblyName)
	{
		foreach (var directory in this.probeDirectories)
		{
			var path = Path.Combine(directory, $"{assemblyName.Name}.dll");
			if (File.Exists(path))
				return this.LoadFromAssemblyPath(path);
		}

		// Shared framework assemblies such as System.Collections.Immutable come from the default context.
		return null;
	}
}
