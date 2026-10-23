<script lang="ts">
	import ProjectsCard from '../config/ProjectsCard.svelte';
	import { suitsKinds } from '../config/scopes.ts';
	import { PROJECT_KIND_TITLES } from '../config/wizardConfig.ts';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { BUILD_PROPERTIES } from './buildProperties.ts';
	import PropertyEditor from './PropertyEditor.svelte';

	const PACKAGES_STEP_GROUPS = ['Central package management', 'NuGet audit and lock files'];
	const KIND_LIST = new Intl.ListFormat('en-US', { type: 'conjunction' });

	const wizard = getWizardState();
	// A property the folder sets or inherits stays visible whatever it holds, so it can be changed or overridden.
	const isSetOrInherited = (name: string) => wizard.resolvedActiveScope.build[name] !== undefined || wizard.resolvedActiveScope.ciBuild[name] !== undefined;
	const properties = $derived(
		BUILD_PROPERTIES.filter(
			property => !property.isOnAnalyzersStep && !PACKAGES_STEP_GROUPS.includes(property.group) && (suitsKinds(property.projectKinds, wizard.reachedKinds) || isSetOrInherited(property.name))
		)
	);
</script>

<header class="step-header">
	<h1>Build</h1>
	<p>MSBuild properties for <code>Directory.Build.props</code>.</p>
</header>

<ul class="note">
	<li>LangVersion and WarningLevel aren't offered: they follow the target framework and AnalysisLevel.</li>
	<li>NoWarn isn't offered: suppressions go in .editorconfig as severity <code>none</code>.</li>
	{#if wizard.reachedKinds.length > 0}
		<li>Showing properties for {KIND_LIST.format(wizard.reachedKinds.map(kind => PROJECT_KIND_TITLES[kind].toLowerCase()))}, the projects this folder's settings reach.</li>
	{/if}
</ul>

<ProjectsCard />

<PropertyEditor {properties} />
