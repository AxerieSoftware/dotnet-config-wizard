/** The oldest .NET the wizard supports, for both the SDK and target frameworks. */
export const MINIMUM_NET_MAJOR = 10;

// net10.0, net11.0, or a platform form such as net10.0-windows.
const TARGET_FRAMEWORK = /^net(?<major>\d+)\.0(-[\w.]+)?$/;

// Since .NET 5 (C# 9), each .NET major's default C# version has been its major plus four.
const CSHARP_MAJOR_OFFSET = 4;

/** The major version of a supported target framework, such as 10 for `net10.0-windows`, or undefined for anything else. */
function toNetMajor(tfm: string): number | undefined {
	const match = TARGET_FRAMEWORK.exec(tfm);
	const major = Number(match?.groups?.major);
	return match && major >= MINIMUM_NET_MAJOR ? major : undefined;
}

export function isSupportedTargetFramework(tfm: string): boolean {
	return toNetMajor(tfm) !== undefined;
}

/** The target frameworks an SDK channel such as `11.0` can build, newest first. */
export function getTargetFrameworksForChannel(channel: string): string[] {
	const channelMajor = Number.parseInt(channel, 10);
	return Array.from({ length: channelMajor - MINIMUM_NET_MAJOR + 1 }, (_, index) => `net${channelMajor - index}.0`);
}

/** The C# version the compiler uses for a target framework. */
export function getDefaultCSharpVersion(tfm: string): string {
	const major = toNetMajor(tfm) ?? MINIMUM_NET_MAJOR;
	return `${major + CSHARP_MAJOR_OFFSET}.0`;
}

/** Compares C# versions such as `14.0` and `15.0` numerically. */
export function compareCSharpVersions(left: string, right: string): number {
	const [leftMajor, leftMinor = 0] = left.split('.').map(Number);
	const [rightMajor, rightMinor = 0] = right.split('.').map(Number);
	return leftMajor - rightMajor || leftMinor - rightMinor;
}
