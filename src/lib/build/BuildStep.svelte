<script lang="ts">
	import ProjectsCard from '../config/ProjectsCard.svelte';
	import { getWizardState } from '../config/wizardState.svelte.ts';
	import { BUILD_PROPERTIES } from './buildProperties.ts';
	import PropertyEditor from './PropertyEditor.svelte';

	const PACKAGES_STEP_GROUPS = ['Central package management', 'NuGet audit and lock files'];

	const wizard = getWizardState();
	const projectKind = $derived(wizard.resolvedActiveScope.projectKind);
	const properties = $derived(
		BUILD_PROPERTIES.filter(
			property => !property.isOnAnalyzersStep && !PACKAGES_STEP_GROUPS.includes(property.group) && (!projectKind || !property.projectKinds || property.projectKinds.includes(projectKind))
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
	{#if projectKind}
		<li>Showing properties for {projectKind} projects. Change the project kind below.</li>
	{/if}
</ul>

<ProjectsCard />

<PropertyEditor {properties} />
