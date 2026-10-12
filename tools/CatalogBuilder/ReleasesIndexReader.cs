using System.Text.Json;

namespace CatalogBuilder;

internal sealed record ChannelInfo(string Channel, string SupportPhase, string ReleaseType, string? EndOfLifeDate, string LatestRuntime);

/// <summary>Reads support details per channel, such as <c>10.0</c>, from the .NET <c>releases-index.json</c>.</summary>
internal static class ReleasesIndexReader
{
	private static readonly string[] PreviewPhases = ["preview", "go-live"];

	public static IReadOnlyDictionary<string, ChannelInfo> Read(string json)
	{
		using var document = JsonDocument.Parse(json);
		var channels = new Dictionary<string, ChannelInfo>(StringComparer.Ordinal);

		foreach (var release in document.RootElement.GetProperty("releases-index").EnumerateArray())
		{
			var channel = release.GetProperty("channel-version").GetString()!;
			channels[channel] = new ChannelInfo(
				channel,
				release.GetProperty("support-phase").GetString()!,
				release.GetProperty("release-type").GetString()!,
				release.TryGetProperty("eol-date", out var endOfLife) && endOfLife.ValueKind == JsonValueKind.String ? endOfLife.GetString() : null,
				release.GetProperty("latest-runtime").GetString()!);
		}

		return channels;
	}

	public static bool IsPreview(ChannelInfo channel) => PreviewPhases.Contains(channel.SupportPhase);
}
