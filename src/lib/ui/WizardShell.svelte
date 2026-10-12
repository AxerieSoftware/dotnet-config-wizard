<script lang="ts">
	import { type Snippet, untrack } from 'svelte';
	import { page } from '$app/state';
	import type { Catalog } from '../catalog/catalog.ts';
	import { setWizardState, WizardState } from '../config/wizardState.svelte.ts';
	import GeneratedFiles from '../export/GeneratedFiles.svelte';
	import { WIZARD_STEPS } from './wizardSteps.ts';

	type Props = { catalog: Catalog; children: Snippet };

	let { catalog, children }: Props = $props();

	// The catalog never changes after the layout loads it, so the state is created once.
	const wizard = setWizardState(new WizardState(untrack(() => catalog)));
	const stepIndex = $derived(WIZARD_STEPS.findIndex(step => step.path === page.url.pathname));
	const previousStep = $derived(stepIndex > 0 ? WIZARD_STEPS[stepIndex - 1] : undefined);
	const nextStep = $derived(stepIndex < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[stepIndex + 1] : undefined);
	const isPreviewShown = $derived(!WIZARD_STEPS[stepIndex]?.isWide);
</script>

<div class="wizard" class:without-preview={!isPreviewShown}>
	<nav aria-label="Wizard steps">
		<ol>
			{#each WIZARD_STEPS as step (step.path)}
				<li><a href={step.path} aria-current={step.path === page.url.pathname ? 'page' : undefined}>{step.title}</a></li>
			{/each}
		</ol>
	</nav>

	<main>
		{@render children()}
		<div class="step-links">
			{#if previousStep}
				<a href={previousStep.path}>← {previousStep.title}</a>
			{/if}
			{#if nextStep}
				<a class="next" href={nextStep.path}>{nextStep.title} →</a>
			{/if}
		</div>
	</main>

	{#if isPreviewShown}
		<aside aria-label="Preview">
			<GeneratedFiles files={wizard.output.files} />
		</aside>
	{/if}
</div>
