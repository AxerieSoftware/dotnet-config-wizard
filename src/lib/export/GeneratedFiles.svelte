<script lang="ts">
	import type { GeneratedFile } from './generatedFile.ts';

	let { files }: { files: GeneratedFile[] } = $props();
</script>

{#each files as file (file.path)}
	<h2 class="file-path">{file.path}</h2>
	<pre class="file" data-testid={`file-${file.path}`}><code>{file.content}</code></pre>
{/each}
