import type { BandEntry } from '../catalog/catalogFiles.ts';
import type { GlobalJsonConfig } from '../config/wizardConfig.ts';

const TESTING_PLATFORM_RUNNER = 'Microsoft.Testing.Platform';

/**
 * Renders `global.json`. The SDK is pinned to the band's latest release; `rollForward` decides how far newer installed
 * SDKs may stand in. Prereleases are allowed only when the band itself is a preview.
 */
export function toGlobalJson(config: GlobalJsonConfig, band: BandEntry): string {
	const globalJson: Record<string, unknown> = {
		sdk: { version: band.sdkVersion, rollForward: config.rollForward, allowPrerelease: band.isPreview }
	};
	if (Object.keys(config.msbuildSdks).length > 0) globalJson['msbuild-sdks'] = config.msbuildSdks;
	if (config.isTestingPlatformRunner) globalJson.test = { runner: TESTING_PLATFORM_RUNNER };

	return `${JSON.stringify(globalJson, undefined, '\t')}\n`;
}
