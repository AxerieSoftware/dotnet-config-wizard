/**
 * Version requirements dotnet/docs doesn't state. Rule IDs map to the C# version or target framework they need;
 * every ID listed must exist in the catalog, which a unit test enforces.
 */
export const MINIMUM_CSHARP_VERSIONS: Readonly<Record<string, string>> = {
	IDE0161: '10.0'
};

/** Rules that suggest APIs older frameworks don't have, keyed to the oldest framework that does. */
export const MINIMUM_TARGET_FRAMEWORKS: Readonly<Record<string, string>> = {
	CA1510: 'net6.0',
	CA1511: 'net7.0',
	CA1512: 'net8.0',
	CA1513: 'net7.0',
	IDE0056: 'netstandard2.1',
	IDE0057: 'netstandard2.1',
	IDE0330: 'net9.0'
};
