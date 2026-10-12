type FrameworkFamily = 'net' | 'netstandard' | 'netframework';

type Framework = { family: FrameworkFamily; version: number };

/** Common target frameworks offered in the wizard, newest first. */
export const COMMON_TARGET_FRAMEWORKS: readonly string[] = ['net11.0', 'net10.0', 'net9.0', 'net8.0', 'netstandard2.1', 'netstandard2.0', 'net481', 'net472'];

const MODERN_NET = /^net(?<version>\d+\.\d+)(-[\w.]+)?$/;
const NET_CORE_APP = /^netcoreapp(?<version>\d+\.\d+)$/;
const NET_STANDARD = /^netstandard(?<version>\d+\.\d+)$/;
const NET_FRAMEWORK = /^net(?<version>\d{2,3})$/;

// The compiler picks its default language version from the target framework.
const DEFAULT_CSHARP_BY_NET_VERSION: readonly [number, string][] = [
	[11, '15.0'],
	[10, '14.0'],
	[9, '13.0'],
	[8, '12.0'],
	[7, '11.0'],
	[6, '10.0'],
	[5, '9.0'],
	[3, '8.0']
];
const LEGACY_DEFAULT_CSHARP = '7.3';

/** Parses `net9.0`, `netcoreapp3.1`, `netstandard2.0` or `net472`; returns undefined for anything else. */
function parseFramework(tfm: string): Framework | undefined {
	const modern = MODERN_NET.exec(tfm) ?? NET_CORE_APP.exec(tfm);
	if (modern?.groups) return { family: 'net', version: Number(modern.groups.version) };

	const standard = NET_STANDARD.exec(tfm);
	if (standard?.groups) return { family: 'netstandard', version: Number(standard.groups.version) };

	const framework = NET_FRAMEWORK.exec(tfm);
	if (framework?.groups) return { family: 'netframework', version: Number(`${framework.groups.version[0]}.${framework.groups.version.slice(1)}`) };

	return undefined;
}

export function isKnownTargetFramework(tfm: string): boolean {
	return parseFramework(tfm) !== undefined;
}

/**
 * Whether a framework has every API another one does. Modern .NET implements .NET Standard 2.1 from netcoreapp3.0 and
 * 2.0 from netcoreapp2.0; .NET Framework implements .NET Standard 2.0 from 4.6.1 and never 2.1.
 */
export function hasApisOf(tfm: string, requiredTfm: string): boolean {
	const framework = parseFramework(tfm);
	const required = parseFramework(requiredTfm);
	if (!framework || !required) return false;

	switch (required.family) {
		case 'net':
			return framework.family === 'net' && framework.version >= required.version;
		case 'netstandard':
			if (framework.family === 'netstandard') return framework.version >= required.version;
			if (framework.family === 'net') return framework.version >= (required.version >= 2.1 ? 3 : 2);
			return required.version <= 2 && framework.version >= 4.61;
		case 'netframework':
			return framework.family === 'netframework' && framework.version >= required.version;
	}
}

/** The C# version the compiler uses for a framework when LangVersion isn't set. */
export function getDefaultCSharpVersion(tfm: string): string {
	const framework = parseFramework(tfm);
	if (framework?.family === 'netstandard' && framework.version >= 2.1) return '8.0';
	if (framework?.family !== 'net') return LEGACY_DEFAULT_CSHARP;

	return DEFAULT_CSHARP_BY_NET_VERSION.find(([netVersion]) => framework.version >= netVersion)?.[1] ?? LEGACY_DEFAULT_CSHARP;
}

/** Compares C# versions such as `7.3` and `12.0` numerically. */
export function compareCSharpVersions(left: string, right: string): number {
	const [leftMajor, leftMinor = 0] = left.split('.').map(Number);
	const [rightMajor, rightMinor = 0] = right.split('.').map(Number);
	return leftMajor - rightMajor || leftMinor - rightMinor;
}
