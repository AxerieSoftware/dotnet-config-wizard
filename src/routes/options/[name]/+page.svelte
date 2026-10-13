<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const option = $derived(data.option);
</script>

<svelte:head>
	<title>{option.name} · .NET Config Wizard</title>
	<meta name="description" content={`${option.name}: values, default and example for this .NET code-style option.`}>
</svelte:head>

<main class="reference">
	<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/options">Options</a><span aria-hidden="true">/</span><span>{option.groupTitle}</span></nav>
	<header class="reference-header">
		<h1 class="mono">{option.name}</h1>
		{#if option.minimumCSharpVersion}
			<p>Needs C# {option.minimumCSharpVersion}</p>
		{/if}
	</header>

	<section class="card">
		<div class="card-header">
			<h2>Values</h2>
			<span class="caption">Default: <code>{option.defaultValue ?? 'none'}</code>{option.allowsMultipleValues ? ' · combine values with commas' : ''}</span>
		</div>
		<dl class="facts">
			{#each option.values as value (value.value)}
				<dt><code>{value.value}</code></dt>
				<dd>{value.description}</dd>
			{/each}
		</dl>
	</section>

	{#if option.example}
		<section class="card">
			<h2>Example</h2>
			<pre class="file"><code>{option.example}</code></pre>
		</section>
	{/if}

	{#if data.rules.length > 0}
		<section class="card">
			<h2>Rules that use it</h2>
			<ul class="reference-list">
				{#each data.rules as rule (rule.id)}
					<li><a class="rule-id" href={`/rules/${rule.id}`}>{rule.id}</a> <span>{rule.title}</span></li>
				{/each}
			</ul>
		</section>
	{/if}

	<p><a href={data.docsUrl} rel="noreferrer">Documentation</a></p>
	<p class="attribution">From <a href="https://github.com/dotnet/docs">dotnet/docs</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</p>
</main>
