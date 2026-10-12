<script lang="ts">
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

<h1>Build</h1>
<p class="lead">
	MSBuild properties for <code>Directory.Build.props</code>. LangVersion, WarningLevel and NoWarn aren't offered: the C# version and warning waves follow the target framework and AnalysisLevel, and
	suppressions belong in .editorconfig.
</p>
{#if projectKind}
	<p class="note">Showing properties for {projectKind} projects. Change the project kind on the Start step to see others.</p>
{/if}

<PropertyEditor {properties} />
