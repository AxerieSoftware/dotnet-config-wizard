<script lang="ts" module>
	import type { CatalogRule } from '../catalog/catalog.ts';
	import type { Severity } from '../config/wizardConfig.ts';

	export type RuleRow = { rule: CatalogRule; configured: Severity | undefined; effective: Severity; blocker: string | undefined; ownerId: string | undefined };
</script>

<script lang="ts">
	import SeveritySelect from '../ui/SeveritySelect.svelte';

	type Props = { rows: RuleRow[]; onSeverityChange: (ruleId: string, severity: Severity | undefined) => void };

	let { rows, onSeverityChange }: Props = $props();

	// Only rows near the viewport are rendered; the catalog has well over a thousand rules. Rendered rows are absolutely
	// positioned, which native table layout can't do, so the table semantics come from ARIA roles (see biome.json).
	const ROW_HEIGHT = 56;
	const VIEWPORT_HEIGHT = 560;
	const OVERSCAN = 6;

	let scrollTop = $state(0);
	const firstIndex = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
	const visibleRows = $derived(rows.slice(firstIndex, firstIndex + Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2));
</script>

<div class="rule-grid" role="table" aria-label="Rules" aria-rowcount={rows.length + 1} style:height={`${VIEWPORT_HEIGHT}px`} onscroll={event => (scrollTop = event.currentTarget.scrollTop)}>
	<div class="rule-grid-row rule-grid-header" role="row" aria-rowindex={1}>
		<div role="columnheader">Rule</div>
		<div role="columnheader">Source</div>
		<div role="columnheader">Effective</div>
		<div role="columnheader">Severity</div>
	</div>
	<div class="rule-grid-body" style:height={`${rows.length * ROW_HEIGHT}px`}>
		{#each visibleRows as row, offset (row.rule.id)}
			<div
				class="rule-grid-row"
				class:unavailable={row.blocker}
				role="row"
				aria-rowindex={firstIndex + offset + 2}
				style:top={`${(firstIndex + offset) * ROW_HEIGHT}px`}
				style:height={`${ROW_HEIGHT}px`}
			>
				<div role="cell" class="rule-cell">
					<span>
						{#if row.rule.helpLink}
							<a href={row.rule.helpLink} target="_blank" rel="noreferrer">{row.rule.id}</a>
						{:else}
							<strong>{row.rule.id}</strong>
						{/if}
						{row.rule.title}
					</span>
					<span class="badges">
						{#if row.blocker}
							<span class="badge">{row.blocker}</span>
						{/if}
						{#if !row.rule.isEnforcedOnBuild}
							<span class="badge">Editor only</span>
						{/if}
						{#if row.rule.hasCodeFix}
							<span class="badge">Code fix</span>
						{/if}
						{#if row.rule.warningLevel && row.rule.warningLevel > 4}
							<span class="badge">Warning wave {row.rule.warningLevel}</span>
						{/if}
						{#if row.ownerId}
							<span class="badge warning-badge">Duplicates {row.ownerId}</span>
						{/if}
					</span>
				</div>
				<div role="cell" class="source-cell">{row.rule.sourceTitle} · {row.rule.category}</div>
				<div role="cell">{row.effective}</div>
				<div role="cell">
					<SeveritySelect ruleId={row.rule.id} disabled={Boolean(row.blocker)} value={row.configured} onchange={severity => onSeverityChange(row.rule.id, severity)} />
				</div>
			</div>
		{/each}
	</div>
</div>
