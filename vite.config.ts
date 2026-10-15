import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const OUTPUT_FOLDERS = ['build', 'build-e2e', '.svelte-kit-e2e', 'test-results', 'playwright-report', '.cache'];

// The e2e build gets its own folders, so building for tests never rewrites the files a running dev server is serving.
const isE2e = process.env.E2E_BUILD === 'true';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},
			adapter: adapter(isE2e ? { pages: 'build-e2e', assets: 'build-e2e' } : {}),
			outDir: isE2e ? '.svelte-kit-e2e' : '.svelte-kit'
		})
	],
	server: {
		// The static build writes thousands of pages; watching them floods the dev server with reloads. The folders are
		// anchored to the repo root, so source folders with the same name, such as src/lib/build, are still watched.
		watch: { ignored: OUTPUT_FOLDERS.map(folder => `${import.meta.dirname}/${folder}/**`) }
	},
	test: {
		expect: { requireAssertions: true },
		passWithNoTests: true,
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
