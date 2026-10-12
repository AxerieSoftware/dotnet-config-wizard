using System.Text.Json;

namespace CatalogBuilder;

/// <summary>
/// The date each rule ID first appeared in the catalog. It only grows: a refresh adds new IDs with the run's date and
/// never changes old ones, so the wizard can tell which rules arrived after a config was made.
/// </summary>
internal static class RuleHistory
{
	public static SortedDictionary<string, string> Update(string? existingJson, IEnumerable<string> ruleIds, DateOnly runDate)
	{
		var history = existingJson is null
			? new SortedDictionary<string, string>(StringComparer.Ordinal)
			: new SortedDictionary<string, string>(JsonSerializer.Deserialize<Dictionary<string, string>>(existingJson)!, StringComparer.Ordinal);

		var date = runDate.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
		foreach (var ruleId in ruleIds)
			history.TryAdd(ruleId, date);

		return history;
	}
}
