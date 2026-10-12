<script lang="ts">
	import { SEVERITIES, type Severity } from '../config/wizardConfig.ts';
	import { toUnsetLabel } from './inheritedLabel.ts';
	import ValueSelect from './ValueSelect.svelte';

	type Props = { ruleId: string; value: Severity | undefined; inheritedValue?: Severity; disabled?: boolean; onchange: (severity: Severity | undefined) => void };

	let { ruleId, value, inheritedValue, disabled = false, onchange }: Props = $props();
</script>

<ValueSelect
	label={`${ruleId} severity`}
	{disabled}
	{value}
	values={SEVERITIES}
	unsetLabel={toUnsetLabel(inheritedValue, 'Default')}
	onchange={severity => onchange(severity as Severity | undefined)}
/>
