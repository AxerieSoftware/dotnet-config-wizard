<script lang="ts">
	import { type Snippet, untrack } from 'svelte';
	import { page } from '$app/state';
	import type { InitialState } from '../config/initialState.ts';
	import { getBrowserStorage, saveState } from '../config/initialState.ts';
	import { setWizardState, WizardState } from '../config/wizardState.svelte.ts';
	import GeneratedFiles from '../export/GeneratedFiles.svelte';
	import ScopeSwitcher from './ScopeSwitcher.svelte';
	import { REVIEW_STEP_PATH, WIZARD_STEPS } from './wizardSteps.ts';

	type Props = { initialState: InitialState; children: Snippet };

	let { initialState, children }: Props = $props();

	// The layout loads the initial state once, so the wizard state is created once.
	const wizard = setWizardState(new WizardState(untrack(() => initialState)));

	const storage = getBrowserStorage();
	$effect(() => saveState(storage, wizard.savedState));
	const stepIndex = $derived(WIZARD_STEPS.findIndex(step => step.path === page.url.pathname));
	const previousStep = $derived(stepIndex > 0 ? WIZARD_STEPS[stepIndex - 1] : undefined);
	const nextStep = $derived(stepIndex < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[stepIndex + 1] : undefined);
	const problemCount = $derived(wizard.issues.filter(issue => issue.severity !== 'info').length);
	const isPreviewShown = $derived(!WIZARD_STEPS[stepIndex]?.isWide);
</script>

<div class="wizard" class:without-preview={!isPreviewShown}>
	<nav aria-label="Wizard steps">
		<ol>
			{#each WIZARD_STEPS as step (step.path)}
				<li>
					<a href={step.path} aria-current={step.path === page.url.pathname ? 'page' : undefined}>
						{step.title}
						{#if step.path === REVIEW_STEP_PATH && problemCount > 0}
							<span class="badge warning-badge">{problemCount}<span class="visually-hidden"> problems</span></span>
						{/if}
					</a>
				</li>
			{/each}
		</ol>
	</nav>

	<main>
		{#if wizard.notice}
			<p class="warning" role="status">
				{wizard.notice}
				<button type="button" class="secondary" onclick={() => (wizard.notice = undefined)}>Dismiss</button>
			</p>
		{/if}
		<ScopeSwitcher />
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
