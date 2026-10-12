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
	<p><a href="/options">All options</a></p>
	<h1><code>{option.name}</code></h1>
	<dl class="facts">
		<dt>Group</dt>
		<dd>{option.groupTitle}</dd>
		<dt>Default</dt>
		<dd><code>{option.defaultValue ?? 'none'}</code></dd>
		<dt>Languages</dt>
		<dd>{option.languages.map(language => (language === 'csharp' ? 'C#' : 'Visual Basic')).join(', ')}</dd>
		{#if option.minimumCSharpVersion}
			<dt>Needs</dt>
			<dd>C# {option.minimumCSharpVersion}</dd>
		{/if}
	</dl>

	<section class="card">
		<h2>Values</h2>
		<ul class="reference-list">
			{#each option.values as value (value.value)}
				<li><code>{value.value}</code> {value.description}</li>
			{/each}
		</ul>
		{#if option.allowsMultipleValues}
			<p class="note">Combine values with commas.</p>
		{/if}
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
					<li><a href={`/rules/${rule.id}`}>{rule.id}</a> {rule.title}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<p><a href={data.docsUrl} rel="noreferrer">Documentation</a></p>
	<p class="note">From <a href="https://github.com/dotnet/docs">dotnet/docs</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</p>
</main>
