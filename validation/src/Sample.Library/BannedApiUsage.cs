using System.Net;
using System.Net.Http;
using System.Text.RegularExpressions;

namespace Sample.Library;

/// <summary>Uses every API in the wizard's banned-API sets, so validation can prove each documentation ID triggers RS0030.</summary>
public static partial class BannedApiUsage
{
	/// <summary>Touches each banned API once.</summary>
	public static void UseEverything(Task<int> pending, CancellationToken cancellationToken)
	{
		_ = DateTime.Now;
		_ = DateTime.UtcNow;
		_ = DateTimeOffset.Now;
		_ = DateTimeOffset.UtcNow;

		using var handler = new HttpClientHandler();
		using var plainClient = new HttpClient();
		using var handlerClient = new HttpClient(handler);
		using var ownedClient = new HttpClient(handler, false);

		pending.Wait();
		pending.Wait(1);
		pending.Wait(TimeSpan.FromMilliseconds(1));
		pending.Wait(cancellationToken);
		pending.Wait(1, cancellationToken);
		pending.Wait(TimeSpan.FromMilliseconds(1), cancellationToken);
		_ = pending.Result;
		Thread.Sleep(1);
		Thread.Sleep(TimeSpan.FromMilliseconds(1));

#pragma warning disable SYSLIB0014 // The legacy networking types are obsolete, which is why they're banned.
		using var webClient = new WebClient();
		HttpWebRequest request = WebRequest.CreateHttp("https://example.com");
		_ = request.Method;
#pragma warning restore SYSLIB0014

		_ = new Regex("a");
		_ = new Regex("a", RegexOptions.None);
		_ = Regex.IsMatch("a", "a");
		_ = Regex.IsMatch("a", "a", RegexOptions.None);
		_ = Regex.Match("a", "a");
		_ = Regex.Match("a", "a", RegexOptions.None);
		_ = Regex.Matches("a", "a");
		_ = Regex.Matches("a", "a", RegexOptions.None);
		_ = Regex.Split("a", "a");
		_ = Regex.Split("a", "a", RegexOptions.None);
		_ = Regex.Count("a", "a");
		_ = Regex.Count("a", "a", RegexOptions.None);
		_ = Regex.Replace("a", "a", "b");
		_ = Regex.Replace("a", "a", "b", RegexOptions.None);
		_ = Regex.Replace("a", "a", match => match.Value);
		_ = Regex.Replace("a", "a", match => match.Value, RegexOptions.None);
		_ = PatternOnly();
		_ = PatternWithOptions();
		_ = PatternWithCulture();

		Console.WriteLine("Done.");
	}

	[GeneratedRegex("a")]
	private static partial Regex PatternOnly();

	[GeneratedRegex("a", RegexOptions.None)]
	private static partial Regex PatternWithOptions();

	[GeneratedRegex("a", RegexOptions.None, "en-US")]
	private static partial Regex PatternWithCulture();
}
