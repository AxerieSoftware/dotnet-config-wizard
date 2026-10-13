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
	<header class="reference-header">
		<h1>Rules</h1>
		<p>{data.rules.length.toLocaleString('en-US')} rules from the .NET SDK, the C# compiler and maintained analyzer packages.</p>
	</header>
	<label class="field"><span>Search</span><input aria-label="Search rules" bind:value={searchText} placeholder="ID or title"></label>
	{#each groups as [sourceTitle, rules] (sourceTitle)}
		<section class="card">
			<div class="card-header">
				<h2>{sourceTitle}</h2>
				<span class="caption">{rules.length} rules</span>
			</div>
			<ul class="reference-list">
				{#each rules as rule (rule.id)}
					<li><a class="rule-id" href={`/rules/${rule.id}`}>{rule.id}</a> <span>{rule.title}</span></li>
				{/each}
			</ul>
		</section>
	{/each}
</main>
