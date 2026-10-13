<script lang="ts">
	import { SEVERITIES, type Severity } from '../config/wizardConfig.ts';
	import ValueSelect from './ValueSelect.svelte';

	type Props = {
		ruleId: string;
		value: Severity | undefined;
		inheritedValue?: Severity;
		/** The severity the rule runs at when this folder leaves it unset. */
		unsetValue?: Severity;
		disabled?: boolean;
		onchange: (severity: Severity | undefined) => void;
	};

	let { ruleId, value, inheritedValue, unsetValue, disabled = false, onchange }: Props = $props();
	const unsetLabel = $derived(`${inheritedValue ? 'Inherited' : 'Default'}${unsetValue ? ` (${unsetValue})` : ''}`);
</script>

<ValueSelect label={`${ruleId} severity`} {disabled} {value} values={SEVERITIES} {unsetLabel} fallbackValue={inheritedValue} onchange={severity => onchange(severity as Severity | undefined)} />
