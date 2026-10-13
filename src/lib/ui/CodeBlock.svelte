<script lang="ts">
	import { type CodeToken, loadCSharpHighlighter, toCodeTokens } from '../export/highlighter.ts';

	/** A highlighted C# snippet, such as an option's example; plain text until the highlighter loads. */
	let { code }: { code: string } = $props();

	let highlighted = $state<{ code: string; tokens: (CodeToken[] | undefined)[] } | undefined>(undefined);
	const tokens = $derived(highlighted?.code === code ? highlighted.tokens : undefined);
	const lines = $derived(code.split('\n'));

	$effect(() => {
		const source = code;
		let isCurrent = true;
		loadCSharpHighlighter()
			.then(highlighter => {
				if (isCurrent) highlighted = { code: source, tokens: toCodeTokens(highlighter, source, 'csharp') };
			})
			.catch(() => {
				// Without the highlighter the snippet still reads as plain text.
			});
		return () => {
			isCurrent = false;
		};
	});
</script>

<pre class="code-block"><code
		>{#each lines as text, index (index)}{#if index > 0}{'\n'}{/if}{#if tokens?.[index]}{#each tokens[index] as token, tokenIndex (tokenIndex)}<span
					style={token.style}>{token.content}</span
				>{/each}{:else}{text}{/if}{/each}</code
	></pre>
