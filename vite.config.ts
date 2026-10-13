import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

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
		// The static build writes thousands of pages; watching them floods the dev server with reloads.
		watch: { ignored: ['**/build/**', '**/build-e2e/**', '**/.svelte-kit-e2e/**', '**/test-results/**', '**/playwright-report/**', '**/.cache/**'] }
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
