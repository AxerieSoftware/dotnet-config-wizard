import type { ProjectKind } from '../config/wizardConfig.ts';

/** One entry of `BannedSymbols.txt`: a documentation ID and the message RS0030 shows. */
export type BannedApi = { symbol: string; message: string };

/**
 * Starter sets for `BannedSymbols.txt`, each with the kinds of project it suits, or none when every kind shares it.
 * Every symbol is a documentation ID that validate-output builds against the sample projects, which use each one, to
 * prove RS0030 fires.
 */
export const BANNED_API_SETS: readonly { title: string; projectKinds?: readonly ProjectKind[]; apis: BannedApi[] }[] = [
	{
		title: 'Clock access: use TimeProvider',
		apis: [
			{ symbol: 'P:System.DateTime.Now', message: 'Use TimeProvider.GetLocalNow() so time can be faked in tests.' },
			{ symbol: 'P:System.DateTime.UtcNow', message: 'Use TimeProvider.GetUtcNow() so time can be faked in tests.' },
			{ symbol: 'P:System.DateTimeOffset.Now', message: 'Use TimeProvider.GetLocalNow() so time can be faked in tests.' },
			{ symbol: 'P:System.DateTimeOffset.UtcNow', message: 'Use TimeProvider.GetUtcNow() so time can be faked in tests.' }
		]
	},
	{
		title: 'HttpClient construction: use IHttpClientFactory',
		apis: [
			{ symbol: 'M:System.Net.Http.HttpClient.#ctor', message: 'Use IHttpClientFactory; creating HttpClient per call exhausts sockets.' },
			{ symbol: 'M:System.Net.Http.HttpClient.#ctor(System.Net.Http.HttpMessageHandler)', message: 'Use IHttpClientFactory; creating HttpClient per call exhausts sockets.' },
			{ symbol: 'M:System.Net.Http.HttpClient.#ctor(System.Net.Http.HttpMessageHandler,System.Boolean)', message: 'Use IHttpClientFactory; creating HttpClient per call exhausts sockets.' }
		]
	},
	{
		title: 'Blocking on tasks: use await',
		apis: [
			{ symbol: 'M:System.Threading.Tasks.Task.Wait', message: 'Await the task; blocking on it risks deadlocks and thread pool starvation.' },
			{ symbol: 'M:System.Threading.Tasks.Task.Wait(System.Int32)', message: 'Await the task; blocking on it risks deadlocks and thread pool starvation.' },
			{ symbol: 'M:System.Threading.Tasks.Task.Wait(System.TimeSpan)', message: 'Await the task; blocking on it risks deadlocks and thread pool starvation.' },
			{ symbol: 'M:System.Threading.Tasks.Task.Wait(System.Threading.CancellationToken)', message: 'Await the task; blocking on it risks deadlocks and thread pool starvation.' },
			{ symbol: 'M:System.Threading.Tasks.Task.Wait(System.Int32,System.Threading.CancellationToken)', message: 'Await the task; blocking on it risks deadlocks and thread pool starvation.' },
			{ symbol: 'M:System.Threading.Tasks.Task.Wait(System.TimeSpan,System.Threading.CancellationToken)', message: 'Await the task; blocking on it risks deadlocks and thread pool starvation.' },
			{ symbol: 'P:System.Threading.Tasks.Task`1.Result', message: 'Await the task; blocking on it risks deadlocks and thread pool starvation.' },
			{ symbol: 'M:System.Threading.Thread.Sleep(System.Int32)', message: "Use await Task.Delay so the thread isn't blocked." },
			{ symbol: 'M:System.Threading.Thread.Sleep(System.TimeSpan)', message: "Use await Task.Delay so the thread isn't blocked." }
		]
	},
	{
		title: 'Regular expressions without a timeout',
		apis: [
			{ symbol: 'M:System.Text.RegularExpressions.Regex.#ctor(System.String)', message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.' },
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.#ctor(System.String,System.Text.RegularExpressions.RegexOptions)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{ symbol: 'M:System.Text.RegularExpressions.Regex.IsMatch(System.String,System.String)', message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.' },
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.IsMatch(System.String,System.String,System.Text.RegularExpressions.RegexOptions)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{ symbol: 'M:System.Text.RegularExpressions.Regex.Match(System.String,System.String)', message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.' },
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.Match(System.String,System.String,System.Text.RegularExpressions.RegexOptions)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{ symbol: 'M:System.Text.RegularExpressions.Regex.Matches(System.String,System.String)', message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.' },
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.Matches(System.String,System.String,System.Text.RegularExpressions.RegexOptions)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{ symbol: 'M:System.Text.RegularExpressions.Regex.Split(System.String,System.String)', message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.' },
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.Split(System.String,System.String,System.Text.RegularExpressions.RegexOptions)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{ symbol: 'M:System.Text.RegularExpressions.Regex.Count(System.String,System.String)', message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.' },
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.Count(System.String,System.String,System.Text.RegularExpressions.RegexOptions)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.Replace(System.String,System.String,System.String)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.Replace(System.String,System.String,System.String,System.Text.RegularExpressions.RegexOptions)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.Replace(System.String,System.String,System.Text.RegularExpressions.MatchEvaluator)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{
				symbol: 'M:System.Text.RegularExpressions.Regex.Replace(System.String,System.String,System.Text.RegularExpressions.MatchEvaluator,System.Text.RegularExpressions.RegexOptions)',
				message: 'Pass a match timeout; without one, crafted input can make the regex run for minutes.'
			},
			{
				symbol: 'M:System.Text.RegularExpressions.GeneratedRegexAttribute.#ctor(System.String)',
				message: 'Pass matchTimeoutMilliseconds; without a timeout, crafted input can make the regex run for minutes.'
			},
			{
				symbol: 'M:System.Text.RegularExpressions.GeneratedRegexAttribute.#ctor(System.String,System.Text.RegularExpressions.RegexOptions)',
				message: 'Pass matchTimeoutMilliseconds; without a timeout, crafted input can make the regex run for minutes.'
			},
			{
				symbol: 'M:System.Text.RegularExpressions.GeneratedRegexAttribute.#ctor(System.String,System.Text.RegularExpressions.RegexOptions,System.String)',
				message: 'Pass matchTimeoutMilliseconds; without a timeout, crafted input can make the regex run for minutes.'
			}
		]
	},
	{
		title: 'Legacy networking: use HttpClient',
		apis: [
			{ symbol: 'T:System.Net.WebClient', message: 'Obsolete; use HttpClient from IHttpClientFactory.' },
			{ symbol: 'T:System.Net.HttpWebRequest', message: 'Obsolete; use HttpClient from IHttpClientFactory.' }
		]
	},
	{
		title: 'Synchronous form reads: use ReadFormAsync',
		projectKinds: ['service'],
		apis: [{ symbol: 'P:Microsoft.AspNetCore.Http.HttpRequest.Form', message: 'Use await Request.ReadFormAsync(); reading Form synchronously blocks a thread on the request body.' }]
	},
	{
		title: 'Console output in libraries: use ILogger',
		projectKinds: ['library'],
		apis: [{ symbol: 'T:System.Console', message: 'Libraries log through ILogger instead of writing to the console.' }]
	}
];

/** Renders `BannedSymbols.txt`, one `<documentation ID>;<message>` per line. */
export function toBannedSymbolsText(apis: readonly BannedApi[]): string {
	return `${apis.map(api => `${api.symbol};${api.message}`).join('\n')}\n`;
}
