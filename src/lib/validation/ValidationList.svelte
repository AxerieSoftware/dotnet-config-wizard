<script lang="ts">
	import type { IssueSeverity, ValidationIssue } from './validateConfig.ts';

	let { issues }: { issues: readonly ValidationIssue[] } = $props();

	const SEVERITY_ORDER: readonly IssueSeverity[] = ['error', 'warning', 'info'];
	const SEVERITY_LABELS: Record<IssueSeverity, string> = { error: 'Error', warning: 'Warning', info: 'Note' };
	const sortedIssues = $derived([...issues].sort((left, right) => SEVERITY_ORDER.indexOf(left.severity) - SEVERITY_ORDER.indexOf(right.severity)));
</script>

<section class="card" aria-labelledby="checks-heading">
	<h2 id="checks-heading">Checks</h2>
	{#if sortedIssues.length === 0}
		<p class="note" data-testid="no-issues">No problems found.</p>
	{:else}
		<ul class="issues">
			{#each sortedIssues as issue, index (index)}
				<li class={`issue issue-${issue.severity}`}>
					<span class="badge">{SEVERITY_LABELS[issue.severity]}</span>
					{#if issue.scopePath}
						<code>{issue.scopePath}/</code>
					{/if}
					{issue.message}
				</li>
			{/each}
		</ul>
	{/if}
</section>
