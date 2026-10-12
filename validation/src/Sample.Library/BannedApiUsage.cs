using System.Net;
using System.Net.Http;

namespace Sample.Library;

/// <summary>Uses every API in the wizard's banned-API sets, so validation can prove each documentation ID triggers RS0030.</summary>
public static class BannedApiUsage
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

		Console.WriteLine("Done.");
	}
}
