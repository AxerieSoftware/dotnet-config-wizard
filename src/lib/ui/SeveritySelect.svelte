<script lang="ts">
	import { SEVERITIES, type Severity } from '../config/wizardConfig.ts';
	import ValueSelect from './ValueSelect.svelte';

	type Props = { ruleId: string; value: Severity | undefined; onchange: (severity: Severity | undefined) => void };

	let { ruleId, value, onchange }: Props = $props();
</script>

<ValueSelect label={`${ruleId} severity`} {value} values={SEVERITIES} unsetLabel="Default" onchange={severity => onchange(severity as Severity | undefined)} />
