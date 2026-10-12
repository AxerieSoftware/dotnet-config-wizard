<script lang="ts">
	import type { GeneratedFile } from './generatedFile.ts';

	let { files }: { files: GeneratedFile[] } = $props();

	// File contents scroll, so each is a focusable, labeled region that keyboard users can scroll (WCAG scrollable regions).
</script>

{#each files as file (file.path)}
	<h2 class="file-path">{file.path}</h2>
	<pre class="file" data-testid={`file-${file.path}`} role="region" tabindex="0" aria-label={`Contents of ${file.path}`}><code>{file.content}</code></pre>
{/each}
