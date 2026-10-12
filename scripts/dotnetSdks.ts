import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIRECTORY = join(import.meta.dirname, '..', '.cache');
const INSTALL_SCRIPT_URL = 'https://builds.dotnet.microsoft.com/dotnet/scripts/v1/dotnet-install.sh';

/** Where SDKs for every cataloged band are installed side by side. */
export const DOTNET_DIRECTORY = join(CACHE_DIRECTORY, 'dotnet');

/** Installs each SDK version into .cache/dotnet with Microsoft's dotnet-install script, skipping ones already there. */
export async function ensureSdksInstalled(sdkVersions: readonly string[]): Promise<void> {
	const missingVersions = sdkVersions.filter(sdkVersion => !existsSync(join(DOTNET_DIRECTORY, 'sdk', sdkVersion)));
	if (missingVersions.length === 0) return;

	mkdirSync(CACHE_DIRECTORY, { recursive: true });
	const installScriptPath = join(CACHE_DIRECTORY, 'dotnet-install.sh');
	const response = await fetch(INSTALL_SCRIPT_URL);
	if (!response.ok) throw new Error(`GET ${INSTALL_SCRIPT_URL} returned ${response.status}.`);
	writeFileSync(installScriptPath, await response.text(), { mode: 0o755 });

	for (const sdkVersion of missingVersions) {
		console.log(`Installing SDK ${sdkVersion}.`);
		const result = spawnSync(installScriptPath, ['--version', sdkVersion, '--install-dir', DOTNET_DIRECTORY, '--no-path'], { stdio: 'inherit' });
		if (result.status !== 0) throw new Error(`Installing SDK ${sdkVersion} exited with ${result.status}.`);
	}
}
