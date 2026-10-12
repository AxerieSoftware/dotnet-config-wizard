/**
 * Minimum C# versions dotnet/docs doesn't state, keyed by rule ID. Every ID listed must exist in the catalog, which a
 * unit test enforces.
 */
export const MINIMUM_CSHARP_VERSIONS: Readonly<Record<string, string>> = {
	IDE0161: '10.0'
};
