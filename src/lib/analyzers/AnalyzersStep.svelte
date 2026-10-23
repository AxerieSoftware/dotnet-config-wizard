<script lang="ts">
	import type { CatalogRule } from '../catalog/catalog.ts';
	import { PACKAGES } from '../catalog/loadCatalog.ts';
	import { suitsKinds } from '../config/scopes.ts';
	import { getRuleBlocker } from '../config/versionGates.ts';
	import { SEVERITIES, type Severity } from '../config/wizardConfig.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import Icon from '../ui/Icon.svelte';
	import { toUnsetLabel } from '../ui/inheritedLabel.ts';
	import ValueSelect from '../ui/ValueSelect.svelte';
	import { ANALYSIS_MODES, type AnalysisMode, parseAnalysisLevel } from './analysisLevel.ts';
	import { PACKAGE_PROJECT_KINDS } from './analyzerPackages.ts';
	import { BANNED_API_SETS } from './bannedApis.ts';
	import { COMPILER_SOURCE, getEffectiveSeverity, isReported } from './effectiveSeverity.ts';
	import { findActiveOverlaps, findCoveringRuleIds } from './overlaps.ts';
	import RuleBrowser, { type RuleRow } from './RuleBrowser.svelte';

	const ALL = '';
	// The rule table lists the SDK's own analyzers first and ASP.NET Core's, which only web projects run, last.
	const SOURCE_ORDER = ['Microsoft.CodeAnalysis.NetAnalyzers', 'Microsoft.CodeAnalysis.CSharp.CodeStyle', COMPILER_SOURCE, 'Microsoft.NET.ILLink.Tasks'];
	const LAST_SOURCE = 'Microsoft.AspNetCore.App.Ref';
	// Compares the digits in IDs by value, so S107 sorts before S1067.
	const NATURAL_ORDER = new Intl.Collator(undefined, { numeric: true });
	const SONAR_PACKAGE = 'SonarAnalyzer.CSharp';
	const BANNED_API_PACKAGE = 'Microsoft.CodeAnalysis.BannedApiAnalyzers';
	const wizard = getWizardState();
	const scope = $derived(wizard.resolvedActiveScope);
	// Public API tracking is for libraries, and the test frameworks' analyzers for tests. A package already chosen stays
	// visible, so it can be cleared.
	const suitedPackages = $derived(PACKAGES.filter(analyzerPackage => suitsKinds(PACKAGE_PROJECT_KINDS[analyzerPackage.id], wizard.reachedKinds) || scope.packages.includes(analyzerPackage.id)));
	// Analyzers that come with a framework, such as MSTest's, are never referenced; selecting one only configures its rules.
	const referencedPackages = $derived(suitedPackages.filter(analyzerPackage => !analyzerPackage.includedWith));
	const frameworkPackages = $derived(suitedPackages.filter(analyzerPackage => analyzerPackage.includedWith));
	const suitedBannedApiSets = $derived(BANNED_API_SETS.filter(set => suitsKinds(set.projectKinds, wizard.reachedKinds)));
	const isInheritingPackages = $derived(!wizard.isRootActive && wizard.activeScope.packages === undefined);
	const inheritedBannedApis = $derived(wizard.inheritedScope?.bannedApis ?? []);
	const analysisMode = $derived(parseAnalysisLevel(scope.build.AnalysisLevel, wizard.catalog.band).mode);

	const filters = wizard.ruleFilters;
	let bulkSeverity = $state<Severity>('warning');

	const availableRules = $derived(
		wizard.catalog.rules
			.values()
			.filter(rule => !rule.packageId || scope.packages.includes(rule.packageId))
			.toArray()
	);
	const isActive = (rule: CatalogRule) => (!rule.packageId || scope.packages.includes(rule.packageId)) && isReported(getEffectiveSeverity(rule, scope, wizard.catalog));
	const overlaps = $derived(findActiveOverlaps(wizard.catalog, isActive));
	const ownerIdsByDuplicate = $derived(new Map(overlaps.flatMap(overlap => overlap.duplicates.map(duplicate => [duplicate.id, overlap.owner.id] as const))));
	// A duplicate that's off says which rule already covers it, so it doesn't look arbitrary.
	const coveringIdsByRule = $derived(findCoveringRuleIds(wizard.catalog, isActive));
	const analyzerCategories = $derived([...new Set(availableRules.filter(rule => rule.source !== COMPILER_SOURCE).map(rule => rule.category))].sort());
	const sources = $derived([...new Set(availableRules.map(rule => rule.sourceTitle))].sort());
	const categories = $derived([...new Set(availableRules.filter(rule => filters.source === ALL || rule.sourceTitle === filters.source).map(rule => rule.category))].sort());
	const sonarRules = $derived(scope.packages.includes(SONAR_PACKAGE) ? availableRules.filter(rule => rule.parameters.length > 0).sort((left, right) => left.id.localeCompare(right.id)) : []);

	// Sorting and each rule's severities don't depend on the filters, so typing in the search only reruns the filter.
	const sortedRules = $derived(
		[...availableRules].sort((left, right) => toSourceRank(left) - toSourceRank(right) || NATURAL_ORDER.compare(left.sourceTitle, right.sourceTitle) || NATURAL_ORDER.compare(left.id, right.id))
	);
	const allRows: RuleRow[] = $derived(
		sortedRules.map(rule => ({
			rule,
			configured: wizard.activeScope.severities?.[rule.id],
			inherited: wizard.inheritedScope?.severities[rule.id],
			effective: getEffectiveSeverity(rule, scope, wizard.catalog),
			blocker: getRuleBlocker(rule, wizard.activeContext),
			ownerId: ownerIdsByDuplicate.get(rule.id),
			coveredById: coveringIdsByRule.get(rule.id)
		}))
	);
	const rows = $derived.by(() => {
		const search = filters.searchText.trim().toLowerCase();
		return allRows.filter(row => matchesFilters(row, search));
	});

	function matchesFilters(row: RuleRow, search: string): boolean {
		if (search && !row.rule.id.toLowerCase().includes(search) && !row.rule.title.toLowerCase().includes(search)) return false;
		if (filters.source !== ALL && row.rule.sourceTitle !== filters.source) return false;
		if (filters.category !== ALL && row.rule.category !== filters.category) return false;
		if (filters.isConfiguredOnly && !row.configured) return false;
		if (filters.isCodeFixOnly && !row.rule.hasCodeFix) return false;
		if (!filters.isUnavailableShown && row.blocker) return false;
		return true;
	}

	function toSourceRank(rule: CatalogRule): number {
		if (rule.source === LAST_SOURCE) return SOURCE_ORDER.length + 1;
		const index = SOURCE_ORDER.indexOf(rule.source);
		return index === -1 ? SOURCE_ORDER.length : index;
	}

	function setBulkSeverity(): void {
		wizard.setSeverities(
			rows.filter(row => !row.blocker).map(row => row.rule.id),
			bulkSeverity
		);
	}
</script>

<header class="step-header">
	<h1>Analyzers</h1>
	<p>Packages, analysis mode and rule severities. Unset rules keep their defaults.</p>
</header>

{#snippet packageRow(
	analyzerPackage: (typeof PACKAGES)[number]
)}
	<label class="package-row">
		<input
			type="checkbox"
			data-package={analyzerPackage.id}
			disabled={isInheritingPackages}
			checked={scope.packages.includes(analyzerPackage.id)}
			onchange={event => wizard.setPackageSelected(analyzerPackage.id, event.currentTarget.checked)}
		>
		<span>
			<strong>{analyzerPackage.title}</strong>
			<!-- Package IDs come from the catalog; <wbr> lets long IDs wrap at their dots without adding characters when copied. -->
			<span class="caption mono">{@html analyzerPackage.id.replaceAll('.', '.<wbr>')} {analyzerPackage.version}</span>
			<span class="caption">{analyzerPackage.ruleCount} rules · released {analyzerPackage.latestPublished}</span>
			{#if analyzerPackage.includedWith || analyzerPackage.isStale || analyzerPackage.isDeprecated}
				<span class="badges">
					{#if analyzerPackage.includedWith}
						<span class="badge">Comes with {analyzerPackage.includedWith}</span>
					{/if}
					{#if analyzerPackage.isStale}
						<span class="badge warning">No release in 18 months</span>
					{/if}
					{#if analyzerPackage.isDeprecated}
						<span class="badge warning">Deprecated</span>
					{/if}
				</span>
			{/if}
		</span>
	</label>
{/snippet}

<section class="card">
	<div class="card-header">
		<h2>Analyzer packages</h2>
		<ul class="note">
			<li>The SDK's analyzers always run, including ASP.NET Core's in web projects.</li>
			<li>Packages are referenced from every project in this folder.</li>
		</ul>
	</div>
	{#if !wizard.isRootActive}
		<label class="checkbox">
			<input type="checkbox" checked={isInheritingPackages} onchange={event => wizard.setInheritsPackages(event.currentTarget.checked)}>
			Same packages as the folder above
		</label>
	{/if}
	<div class="package-list">
		{#each referencedPackages as analyzerPackage (analyzerPackage.id)}
			{@render packageRow(analyzerPackage)}
		{/each}
	</div>
	{#if frameworkPackages.length > 0}
		<div class="stack">
			<h3>Frameworks you use</h3>
			<p class="note">Their analyzers ship with the framework, so no package is added. Pick yours to configure their rules.</p>
			<div class="package-list">
				{#each frameworkPackages as analyzerPackage (analyzerPackage.id)}
					{@render packageRow(analyzerPackage)}
				{/each}
			</div>
		</div>
	{/if}
</section>

<section class="card">
	<h2>.NET analyzers</h2>
	<div class="field-grid">
		<label class="field">
			<span>Analysis mode</span>
			<select aria-label="Analysis mode" data-setting="AnalysisLevel" value={analysisMode} onchange={event => wizard.setAnalysisMode(event.currentTarget.value as AnalysisMode)}>
				{#each ANALYSIS_MODES as mode (mode)}
					<option value={mode}>{mode}</option>
				{/each}
			</select>
		</label>
		{#if wizard.isRootActive}
			<label class="field">
				<span>Write severities to</span>
				<select
					aria-label="Severity file"
					value={wizard.config.severityFile ?? 'editorconfig'}
					onchange={event => wizard.setSeverityFile(event.currentTarget.value as 'editorconfig' | 'globalconfig')}
				>
					<option value="editorconfig">.editorconfig, by folder</option>
					<option value="globalconfig">Analyzers.globalconfig, by project</option>
				</select>
			</label>
		{/if}
	</div>
	<label class="checkbox">
		<input
			type="checkbox"
			data-setting="EnforceCodeStyleInBuild"
			checked={scope.build.EnforceCodeStyleInBuild === 'true'}
			onchange={event => wizard.setBuildProperty('EnforceCodeStyleInBuild', event.currentTarget.checked ? 'true' : undefined)}
		>
		Enforce code style on build
	</label>
	<ul class="caption">
		<li>Written as <code>AnalysisLevel=latest-&lt;mode&gt;</code>, so new rules arrive with SDK updates.</li>
		<li>Without enforcing code style on build, IDE rules only show in the editor.</li>
	</ul>
</section>

<section class="card">
	<div class="card-header">
		<h2>Category severities</h2>
		<p class="note">Sets every rule in a category. A rule's own severity still wins.</p>
	</div>
	<div class="field-grid">
		{#each analyzerCategories as category (category)}
			<label class="field">
				<span>{category}</span>
				<ValueSelect
					label={`${category} category severity`}
					value={wizard.activeScope.categorySeverities?.[category]}
					values={SEVERITIES}
					unsetLabel={toUnsetLabel(wizard.inheritedScope?.categorySeverities[category], 'Default')}
					fallbackValue={wizard.inheritedScope?.categorySeverities[category]}
					onchange={severity => wizard.setCategorySeverity(category, severity as Severity | undefined)}
				/>
			</label>
		{/each}
	</div>
</section>

{#if overlaps.length > 0}
	<section class="card" aria-labelledby="overlaps-heading">
		<div class="card-header">
			<h2 id="overlaps-heading">Duplicate rules</h2>
			<button
				type="button"
				onclick={() =>
					wizard.setSeverities(
						overlaps.flatMap(overlap => overlap.duplicates.map(duplicate => duplicate.id)),
						'none'
					)}
			>
				Turn off all duplicates
			</button>
			<p class="note">Each of these is reported twice. The first rule keeps it.</p>
		</div>
		<div class="rows">
			{#each overlaps as overlap (overlap.concern)}
				<div class="rule-row plain">
					<span>
						<Icon name="warning" />
						<strong>{overlap.concern}</strong>
						<span><span class="rule-id">{overlap.owner.id}</span> ({overlap.owner.sourceTitle}), also {overlap.duplicates.map(duplicate => duplicate.id).join(', ')}</span>
					</span>
					<button
						type="button"
						class="small"
						onclick={() =>
							wizard.setSeverities(
								overlap.duplicates.map(duplicate => duplicate.id),
								'none'
							)}
					>
						Turn off duplicates
					</button>
				</div>
			{/each}
		</div>
	</section>
{/if}

<section class="card">
	<h2>Rules</h2>
	<div class="toolbar">
		<label class="field"><span>Search</span><input aria-label="Search rules" bind:value={filters.searchText} placeholder="ID or title"></label>
		<label class="field">
			<span>Source</span>
			<select aria-label="Source" bind:value={filters.source} onchange={() => (filters.category = ALL)}>
				<option value={ALL}>All sources</option>
				{#each sources as source (source)}
					<option value={source}>{source}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			<span>Category</span>
			<select aria-label="Category" bind:value={filters.category}>
				<option value={ALL}>All categories</option>
				{#each categories as category (category)}
					<option value={category}>{category}</option>
				{/each}
			</select>
		</label>
	</div>
	<div class="filter-chips">
		<label class="checkbox"><input type="checkbox" bind:checked={filters.isConfiguredOnly}> Set in this folder</label>
		<label class="checkbox"><input type="checkbox" bind:checked={filters.isCodeFixOnly}> Has a code fix</label>
		<label class="checkbox"><input type="checkbox" bind:checked={filters.isUnavailableShown}> Include rules the C# version can't use</label>
	</div>
	<div class="bulk-bar">
		<span class="count" data-testid="rule-count">{rows.length.toLocaleString('en-US')} {rows.length === 1 ? 'rule' : 'rules'}</span>
		<ValueSelect
			label="Severity for every shown rule"
			value={bulkSeverity}
			values={SEVERITIES}
			unsetLabel="Default"
			onchange={value => (bulkSeverity = (value as Severity | undefined) ?? 'warning')}
		/>
		<button type="button" onclick={setBulkSeverity}>Set shown rules</button>
	</div>
	<RuleBrowser {rows} onSeverityChange={(ruleId, severity) => wizard.setSeverity(ruleId, severity)} />
</section>

{#if sonarRules.length > 0 && wizard.isRootActive}
	<section class="card">
		<div class="card-header">
			<h2>Sonar rule parameters</h2>
			<p class="note">Written to <code>SonarLint.xml</code>. Empty keeps Sonar's default.</p>
		</div>
		<div class="rows">
			{#each sonarRules as rule (rule.id)}
				<div class="stack param-row">
					<span><span class="rule-id">{rule.id}</span> {rule.title}</span>
					<div class="field-grid">
						{#each rule.parameters as parameter (parameter.key)}
							<label class="field">
								<span>{parameter.key}</span>
								<input
									aria-label={`${rule.id} ${parameter.key}`}
									title={parameter.description}
									class:changed={(scope.ruleParameters[rule.id]?.[parameter.key] ?? parameter.defaultValue) !== parameter.defaultValue}
									value={scope.ruleParameters[rule.id]?.[parameter.key] ?? ''}
									placeholder={parameter.defaultValue ?? ''}
									onchange={event => wizard.setRuleParameter(rule.id, parameter.key, event.currentTarget.value.trim() || undefined)}
								>
							</label>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if scope.packages.includes(BANNED_API_PACKAGE)}
	<section class="card">
		<div class="card-header">
			<h2>Banned APIs</h2>
			<p class="note">Written to <code>BannedSymbols.txt</code>. Using one reports RS0030.</p>
		</div>
		<div class="actions">
			{#each suitedBannedApiSets as set (set.title)}
				<button type="button" class="small" onclick={() => wizard.addBannedApis(set.apis)}>Add: {set.title}</button>
			{/each}
		</div>
		<div class="rows">
			{#each inheritedBannedApis as api (api.symbol)}
				<div class="rule-row plain unavailable">
					<span><code>{api.symbol}</code> {api.message}</span>
					<span class="badge">Inherited</span>
				</div>
			{/each}
			{#each wizard.activeScope.bannedApis ?? [] as api (api.symbol)}
				<div class="rule-row plain">
					<span><code>{api.symbol}</code> {api.message}</span>
					<button type="button" class="subtle small" onclick={() => wizard.removeBannedApi(api.symbol)}>Remove</button>
				</div>
			{/each}
		</div>
	</section>
{/if}
