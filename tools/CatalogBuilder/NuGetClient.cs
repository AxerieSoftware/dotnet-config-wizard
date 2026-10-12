using System.IO.Compression;
using System.Text.Json;

namespace CatalogBuilder;

/// <summary>When a package version was published and whether its author deprecated it.</summary>
internal sealed record PackageVersionInfo(string Version, DateTimeOffset Published, bool IsDeprecated);

/// <summary>Reads package versions and metadata from nuget.org and extracts packages into a local cache.</summary>
internal sealed class NuGetClient(HttpClient httpClient, string cacheDirectory)
{
	private const string FlatContainerUrl = "https://api.nuget.org/v3-flatcontainer";
	private const string RegistrationUrl = "https://api.nuget.org/v3/registration5-gz-semver2";

	private readonly HttpClient httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
	private readonly string cacheDirectory = cacheDirectory ?? throw new ArgumentNullException(nameof(cacheDirectory));

	/// <summary>Every published version, oldest first, including prereleases.</summary>
	public async Task<IReadOnlyList<string>> GetVersionsAsync(string packageId)
	{
		using var document = await this.GetJsonAsync($"{FlatContainerUrl}/{packageId.ToLowerInvariant()}/index.json");
		return document.RootElement.GetProperty("versions").EnumerateArray().Select(version => version.GetString()!).ToList();
	}

	public async Task<PackageVersionInfo> GetVersionInfoAsync(string packageId, string version)
	{
		using var leaf = await this.GetJsonAsync($"{RegistrationUrl}/{packageId.ToLowerInvariant()}/{version.ToLowerInvariant()}.json");
		var published = leaf.RootElement.GetProperty("published").GetDateTimeOffset();

		using var catalogEntry = await this.GetJsonAsync(leaf.RootElement.GetProperty("catalogEntry").GetString()!);
		var isDeprecated = catalogEntry.RootElement.TryGetProperty("deprecation", out _);

		return new PackageVersionInfo(version, published, isDeprecated);
	}

	/// <summary>Downloads and extracts a package once, returning the folder it's extracted to.</summary>
	public async Task<string> ExtractAsync(string packageId, string version)
	{
		var directory = Path.Combine(this.cacheDirectory, packageId.ToLowerInvariant(), version.ToLowerInvariant());
		if (Directory.Exists(directory))
			return directory;

		var id = packageId.ToLowerInvariant();
		var lowerVersion = version.ToLowerInvariant();
		await using var stream = await this.httpClient.GetStreamAsync($"{FlatContainerUrl}/{id}/{lowerVersion}/{id}.{lowerVersion}.nupkg");
		using var archive = new ZipArchive(stream, ZipArchiveMode.Read);

		// Extract to a temporary folder first so an interrupted download never leaves a half-extracted package behind.
		var temporaryDirectory = $"{directory}.partial";
		if (Directory.Exists(temporaryDirectory))
			Directory.Delete(temporaryDirectory, recursive: true);
		await archive.ExtractToDirectoryAsync(temporaryDirectory);
		Directory.Move(temporaryDirectory, directory);
		return directory;
	}

	private async Task<JsonDocument> GetJsonAsync(string url)
	{
		await using var stream = await this.httpClient.GetStreamAsync(url);
		return await JsonDocument.ParseAsync(stream);
	}
}
