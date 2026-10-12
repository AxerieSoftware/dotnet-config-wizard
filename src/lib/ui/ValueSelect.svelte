<script lang="ts">
	type Props = { label: string; value: string | undefined; values: readonly string[]; unsetLabel: string; onchange: (value: string | undefined) => void };

	let { label, value, values, unsetLabel, onchange }: Props = $props();
</script>

<select aria-label={label} value={value ?? ''} onchange={event => onchange(event.currentTarget.value === '' ? undefined : event.currentTarget.value)}>
	<option value="">{unsetLabel}</option>
	{#each values as option (option)}
		<option value={option}>{option}</option>
	{/each}
</select>
