<script lang="ts">
	type Props = {
		label: string;
		value: string | undefined;
		values: readonly string[];
		unsetLabel: string;
		/** The value that applies while this one is unset, inherited or default, when known. */
		fallbackValue?: string;
		disabled?: boolean;
		onchange: (value: string | undefined) => void;
	};

	let { label, value, values, unsetLabel, fallbackValue, disabled = false, onchange }: Props = $props();
</script>

<select
	aria-label={label}
	class:changed={value !== undefined && value !== fallbackValue}
	{disabled}
	value={value ?? ''}
	onchange={event => onchange(event.currentTarget.value === '' ? undefined : event.currentTarget.value)}
>
	<option value="">{unsetLabel}</option>
	{#each values as option (option)}
		<option value={option}>{option}</option>
	{/each}
</select>
