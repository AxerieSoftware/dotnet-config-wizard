<script lang="ts">
	import { PACKAGES } from '../catalog/loadCatalog.ts';
	import { getRuleBlocker } from '../config/versionGates.ts';
	import { SEVERITIES, type Severity } from '../config/wizardConfig.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import ValueSelect from '../ui/ValueSelect.svelte';
	import { ANALYSIS_MODES, type AnalysisMode, parseAnalysisLevel } from './analysisLevel.ts';
	import { BANNED_API_SETS } from './bannedApis.ts';
	import { getEffectiveSeverity, isReported } from './effectiveSeverity.ts';
	import { findActiveOverlaps } from './overlaps.ts';
	import RuleBrowser, { type RuleRow } from './RuleBrowser.svelte';

	const ALL = '';
	const SONAR_PACKAGE = 'SonarAnalyzer.CSharp';
	const BANNED_API_PACKAGE = 'Microsoft.CodeAnalysis.BannedApiAnalyzers';

	const wizard = getWizardState();
	const scope = $derived(wizard.resolvedActiveScope);
	const isInheritingPackages = $derived(!wizard.isRootActive && wizard.activeScope.packages === undefined);
	const inheritedBannedApis = $derived(wizard.inheritedScope?.bannedApis ?? []);
	const analysisMode = $derived(parseAnalysisLevel(scope.build.AnalysisLevel, wizard.catalog.band).mode);

	let searchText = $state('');
	let sourceFilter = $state(ALL);
	let categoryFilter = $state(ALL);
	let isConfiguredOnly = $state(false);
	let isCodeFixOnly = $state(false);
	let isUnavailableShown = $state(false);
	let bulkSeverity = $state<Severity>('warning');

	const availableRules = $derived(
		wizard.catalog.rules
			.values()
			.filter(rule => !rule.packageId || scope.packages.includes(rule.packageId))
			.toArray()
	);
	const overlaps = $derived(findActiveOverlaps(wizard.catalog, rule => (!rule.packageId || scope.packages.includes(rule.packageId)) && isReported(getEffectiveSeverity(rule, scope, wizard.catalog))));
	const ownerIdsByDuplicate = $derived(new Map(overlaps.flatMap(overlap => overlap.duplicates.map(duplicate => [duplicate.id, overlap.owner.id] as const))));
	const sources = $derived([...new Set(availableRules.map(rule => rule.sourceTitle))].sort());
	const categories = $derived([...new Set(availableRules.filter(rule => sourceFilter === ALL || rule.sourceTitle === sourceFilter).map(rule => rule.category))].sort());
	const sonarRules = $derived(scope.packages.includes(SONAR_PACKAGE) ? availableRules.filter(rule => rule.parameters.length > 0).sort((left, right) => left.id.localeCompare(right.id)) : []);

	const rows: RuleRow[] = $derived(
		availableRules
			.map(rule => ({
				rule,
				configured: wizard.activeScope.severities?.[rule.id],
				inherited: wizard.inheritedScope?.severities[rule.id],
				effective: getEffectiveSeverity(rule, scope, wizard.catalog),
				blocker: getRuleBlocker(rule, wizard.activeContext),
				ownerId: ownerIdsByDuplicate.get(rule.id)
			}))
			.filter(row => matchesFilters(row))
			.sort((left, right) => left.rule.id.localeCompare(right.rule.id, undefined, { numeric: true }))
	);

	function matchesFilters(row: RuleRow): boolean {
		const search = searchText.trim().toLowerCase();
		if (search && !row.rule.id.toLowerCase().includes(search) && !row.rule.title.toLowerCase().includes(search)) return false;
		if (sourceFilter !== ALL && row.rule.sourceTitle !== sourceFilter) return false;
		if (categoryFilter !== ALL && row.rule.category !== categoryFilter) return false;
		if (isConfiguredOnly && !row.configured) return false;
		if (isCodeFixOnly && !row.rule.hasCodeFix) return false;
		if (!isUnavailableShown && row.blocker) return false;
		return true;
	}

	function setBulkSeverity(): void {
		wizard.setSeverities(
			rows.filter(row => !row.blocker).map(row => row.rule.id),
			bulkSeverity
		);
	}
</script>

<h1>Analyzers</h1>
<p class="lead">Pick analyzer packages, how strict the built-in .NET analyzers are, and the severity of any rule. Severities you don't set keep each analyzer's default.</p>

<section class="card">
	<h2>Analyzer packages</h2>
	<p class="note">The SDK's own analyzers always run. Packages are referenced from every project in this folder; their rules only apply where they're referenced.</p>
	{#if !wizard.isRootActive}
		<label class="checkbox">
			<input type="checkbox" checked={isInheritingPackages} onchange={event => wizard.setInheritsPackages(event.currentTarget.checked)}>
			Same packages as the folder above
		</label>
	{/if}
	{#each PACKAGES as analyzerPackage (analyzerPackage.id)}
		<label class="checkbox package-row">
			<input
				type="checkbox"
				disabled={isInheritingPackages}
				checked={scope.packages.includes(analyzerPackage.id)}
				onchange={event => wizard.setPackageSelected(analyzerPackage.id, event.currentTarget.checked)}
			>
			<span>
				<strong>{analyzerPackage.title}</strong>
				<code>{analyzerPackage.id} {analyzerPackage.version}</code>
				<span class="note">{analyzerPackage.ruleCount} rules, last released {analyzerPackage.latestPublished}</span>
				{#if analyzerPackage.isStale}
					<span class="badge warning-badge">No release in 18 months</span>
				{/if}
				{#if analyzerPackage.isDeprecated}
					<span class="badge warning-badge">Deprecated</span>
				{/if}
			</span>
		</label>
	{/each}
</section>

<section class="card">
	<h2>.NET analyzers</h2>
	<div class="field-grid">
		<label class="field">
			<span>Analysis mode</span>
			<select aria-label="Analysis mode" value={analysisMode} onchange={event => wizard.setAnalysisMode(event.currentTarget.value as AnalysisMode)}>
				{#each ANALYSIS_MODES as mode (mode)}
					<option value={mode}>{mode}</option>
				{/each}
			</select>
		</label>
		<label class="checkbox">
			<input
				type="checkbox"
				checked={scope.build.EnforceCodeStyleInBuild === 'true'}
				onchange={event => wizard.setBuildProperty('EnforceCodeStyleInBuild', event.currentTarget.checked ? 'true' : undefined)}
			>
			Enforce code style on build
		</label>
	</div>
	{#if wizard.isRootActive}
		<label class="field">
			<span>Write rule severities to (whole repo)</span>
			<select aria-label="Severity file" value={wizard.config.severityFile ?? 'editorconfig'} onchange={event => wizard.setSeverityFile(event.currentTarget.value as 'editorconfig' | 'globalconfig')}>
				<option value="editorconfig">.editorconfig, by folder</option>
				<option value="globalconfig">Analyzers.globalconfig, by project</option>
			</select>
		</label>
	{/if}
	<p class="note">
		The mode is written as <code>AnalysisLevel=latest-&lt;mode&gt;</code> so new rules arrive with SDK updates. Without enforcing code style on build, IDE rules only show in the editor.
	</p>
</section>

{#if overlaps.length > 0}
	<section class="card" aria-labelledby="overlaps-heading">
		<h2 id="overlaps-heading">Duplicate rules</h2>
		<p class="note">These concerns are checked by more than one active rule, so each problem would be reported twice. The first rule listed keeps the concern.</p>
		{#each overlaps as overlap (overlap.concern)}
			<div class="rule-row">
				<span><strong>{overlap.concern}</strong>: {overlap.owner.id} ({overlap.owner.sourceTitle}), also {overlap.duplicates.map(duplicate => duplicate.id).join(', ')}</span>
				<button
					type="button"
					class="secondary"
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
	</section>
{/if}

<section class="card">
	<h2>Rules</h2>
	<div class="field-grid">
		<label class="field"><span>Search</span><input aria-label="Search rules" bind:value={searchText} placeholder="ID or title"></label>
		<label class="field">
			<span>Source</span>
			<select aria-label="Source" bind:value={sourceFilter} onchange={() => (categoryFilter = ALL)}>
				<option value={ALL}>All sources</option>
				{#each sources as source (source)}
					<option value={source}>{source}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			<span>Category</span>
			<select aria-label="Category" bind:value={categoryFilter}>
				<option value={ALL}>All categories</option>
				{#each categories as category (category)}
					<option value={category}>{category}</option>
				{/each}
			</select>
		</label>
	</div>
	<div class="actions wrap">
		<label class="checkbox"><input type="checkbox" bind:checked={isConfiguredOnly}> Configured only</label>
		<label class="checkbox"><input type="checkbox" bind:checked={isCodeFixOnly}> Has a code fix</label>
		<label class="checkbox"><input type="checkbox" bind:checked={isUnavailableShown}> Show rules the C# version can't use</label>
	</div>
	<div class="actions">
		<span class="note" data-testid="rule-count">{rows.length} rules</span>
		<ValueSelect
			label="Severity for every shown rule"
			value={bulkSeverity}
			values={SEVERITIES}
			unsetLabel="Default"
			onchange={value => (bulkSeverity = (value as Severity | undefined) ?? 'warning')}
		/>
		<button type="button" class="secondary" onclick={setBulkSeverity}>Set shown rules</button>
	</div>
	<RuleBrowser {rows} onSeverityChange={(ruleId, severity) => wizard.setSeverity(ruleId, severity)} />
</section>

{#if sonarRules.length > 0 && wizard.isRootActive}
	<section class="card">
		<h2>Sonar rule parameters</h2>
		<p class="note">Written to <code>SonarLint.xml</code>, which Sonar reads for the whole repo. Leave a value empty to keep Sonar's default.</p>
		{#each sonarRules as rule (rule.id)}
			<div class="option-row">
				<strong>{rule.id}</strong>
				{rule.title}
				<div class="field-grid">
					{#each rule.parameters as parameter (parameter.key)}
						<label class="field">
							<span>{parameter.key}</span>
							<input
								aria-label={`${rule.id} ${parameter.key}`}
								title={parameter.description}
								value={scope.ruleParameters[rule.id]?.[parameter.key] ?? ''}
								placeholder={parameter.defaultValue ?? ''}
								onchange={event => wizard.setRuleParameter(rule.id, parameter.key, event.currentTarget.value.trim() || undefined)}
							>
						</label>
					{/each}
				</div>
			</div>
		{/each}
	</section>
{/if}

{#if scope.packages.includes(BANNED_API_PACKAGE)}
	<section class="card">
		<h2>Banned APIs</h2>
		<p class="note">Written to <code>BannedSymbols.txt</code>; using one reports RS0030.</p>
		<div class="actions wrap">
			{#each BANNED_API_SETS as set (set.title)}
				<button type="button" class="secondary" onclick={() => wizard.addBannedApis(set.apis)}>Add: {set.title}</button>
			{/each}
		</div>
		{#each inheritedBannedApis as api (api.symbol)}
			<div class="rule-row unavailable">
				<span><code>{api.symbol}</code> {api.message}</span>
				<span class="badge">Inherited</span>
			</div>
		{/each}
		{#each wizard.activeScope.bannedApis ?? [] as api (api.symbol)}
			<div class="rule-row">
				<span><code>{api.symbol}</code> {api.message}</span>
				<button type="button" class="secondary" onclick={() => wizard.removeBannedApi(api.symbol)}>Remove</button>
			</div>
		{/each}
	</section>
{/if}
