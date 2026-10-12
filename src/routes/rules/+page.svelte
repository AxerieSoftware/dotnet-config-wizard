<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let searchText = $state('');
	const groups = $derived(
		Map.groupBy(
			data.rules.filter(rule => `${rule.id} ${rule.title}`.toLowerCase().includes(searchText.trim().toLowerCase())),
			rule => rule.sourceTitle
		)
			.entries()
			.toArray()
			.sort(([left], [right]) => left.localeCompare(right))
	);
</script>

<svelte:head>
	<title>Rules · .NET Config Wizard</title>
	<meta name="description" content="Every .NET analyzer rule and compiler warning the wizard can configure, with what it checks and how to set it.">
</svelte:head>

<main class="reference">
	<h1>Rules</h1>
	<p class="lead">{data.rules.length} rules from the .NET SDK, the C# compiler and maintained analyzer packages.</p>
	<label class="field"><span>Search</span><input aria-label="Search rules" bind:value={searchText} placeholder="ID or title"></label>
	{#each groups as [sourceTitle, rules] (sourceTitle)}
		<section class="card">
			<h2>{sourceTitle}</h2>
			<ul class="reference-list">
				{#each rules as rule (rule.id)}
					<li><a href={`/rules/${rule.id}`}>{rule.id}</a> {rule.title}</li>
				{/each}
			</ul>
		</section>
	{/each}
</main>
