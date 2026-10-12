<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const rule = $derived(data.rule);
	const defaultSeverity = $derived(rule.isEnabledByDefault ? rule.defaultSeverity : 'none (off by default)');
	const isSonar = $derived(rule.packageId === 'SonarAnalyzer.CSharp');
</script>

<svelte:head>
	<title>{rule.id}: {rule.title} · .NET Config Wizard</title>
	<meta name="description" content={`${rule.id} (${rule.sourceTitle}): ${rule.title}. How to configure it in .editorconfig.`}>
</svelte:head>

<main class="reference">
	<p><a href="/rules">All rules</a></p>
	<h1>{rule.id}: {rule.title}</h1>
	<dl class="facts">
		<dt>Analyzer</dt>
		<dd>{rule.sourceTitle}{rule.packageId ? ` (NuGet package ${rule.packageId})` : ', part of the .NET SDK'}</dd>
		<dt>Category</dt>
		<dd>{rule.category}</dd>
		<dt>Default severity</dt>
		<dd>{defaultSeverity}</dd>
		<dt>Runs on build</dt>
		<dd>{rule.isEnforcedOnBuild ? 'Yes' : 'No, only in the editor'}</dd>
		<dt>Code fix</dt>
		<dd>{rule.hasCodeFix ? 'Yes' : 'No'}</dd>
		{#if rule.minimumCSharpVersion}
			<dt>Needs</dt>
			<dd>C# {rule.minimumCSharpVersion}</dd>
		{/if}
		{#if rule.warningLevel}
			<dt>Warning level</dt>
			<dd>{rule.warningLevel}{rule.warningLevel > 4 ? ' (a warning wave AnalysisLevel turns on)' : ''}</dd>
		{/if}
		<dt>SDK bands</dt>
		<dd>{data.bands.join(', ')}</dd>
		{#if data.firstSeen}
			<dt>In the catalog since</dt>
			<dd>{data.firstSeen}</dd>
		{/if}
	</dl>

	<section class="card">
		<h2>Configure it</h2>
		<pre class="file"><code># {rule.id}: {rule.title}
dotnet_diagnostic.{rule.id}.severity = warning</code></pre>
		{#if rule.source !== 'Microsoft.CodeAnalysis.CSharp'}
			<p class="note">Or set its whole category: <code>dotnet_analyzer_diagnostic.category-{rule.category}.severity</code>.</p>
		{/if}
		<p><a class="button" href="/wizard/start">Configure it in the wizard</a></p>
	</section>

	{#if data.options.length > 0}
		<section class="card">
			<h2>Options</h2>
			<ul class="reference-list">
				{#each data.options as option (option.name)}
					<li>
						<a href={`/options/${option.name}`}><code>{option.name}</code></a> {option.groupTitle}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.duplicateConcerns.length > 0}
		<section class="card">
			<h2>Overlaps</h2>
			{#each data.duplicateConcerns as concern (concern.concern)}
				<p>{concern.concern} is also checked by {concern.otherRuleIds.length > 0 ? concern.otherRuleIds.join(', ') : 'another analyzer package'}. Keep one active.</p>
			{/each}
		</section>
	{/if}

	{#if rule.helpLink}
		<p><a href={rule.helpLink} rel="noreferrer">{isSonar ? 'Rule description on rules.sonarsource.com' : 'Documentation'}</a></p>
	{/if}
	{#if rule.source === 'Microsoft.CodeAnalysis.CSharp.CodeStyle' && !rule.isEnforcedOnBuild}
		<p class="note">Title from <a href="https://github.com/dotnet/docs">dotnet/docs</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</p>
	{/if}
</main>
