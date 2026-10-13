<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const groups = $derived(
		Map.groupBy(
			[...data.options].sort((left, right) => left.groupOrder - right.groupOrder),
			option => option.groupTitle
		)
			.entries()
			.toArray()
	);
</script>

<svelte:head>
	<title>Code-style options · .NET Config Wizard</title>
	<meta name="description" content="Every .NET and C# code-style and formatting option for .editorconfig, with values, defaults and examples.">
</svelte:head>

<main class="reference">
	<header class="reference-header">
		<h1>Code-style options</h1>
		<p>{data.options.length} .editorconfig options for .NET code style and C# formatting.</p>
	</header>
	{#each groups as [groupTitle, options] (groupTitle)}
		<section class="card">
			<h2>{groupTitle}</h2>
			<ul class="reference-list">
				{#each options as option (option.name)}
					<li><a class="mono" href={`/options/${option.name}`}>{option.name}</a></li>
				{/each}
			</ul>
		</section>
	{/each}
	<p class="attribution">From <a href="https://github.com/dotnet/docs">dotnet/docs</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</p>
</main>
