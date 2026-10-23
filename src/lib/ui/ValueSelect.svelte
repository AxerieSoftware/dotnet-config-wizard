<script lang="ts">
	type Props = {
		label: string;
		value: string | undefined;
		values: readonly string[];
		unsetLabel: string;
		/** The value that applies while this one is unset, inherited or default, when known. */
		fallbackValue?: string;
		/** How a value reads in the list, when it isn't the value itself. */
		toLabel?: (value: string) => string;
		disabled?: boolean;
		onchange: (value: string | undefined) => void;
	};

	let { label, value, values, unsetLabel, fallbackValue, toLabel = option => option, disabled = false, onchange }: Props = $props();
</script>

<select
	aria-label={label}
	class:changed={value !== undefined && value !== fallbackValue}
	{disabled}
	value={value ?? ''}
	onchange={event => {
		onchange(event.currentTarget.value === '' ? undefined : event.currentTarget.value);
		// Resets to the state's value, since a change that waits on a confirmation or is declined leaves the state unchanged.
		event.currentTarget.value = value ?? '';
	}}
>
	<option value="">{unsetLabel}</option>
	{#each values as option (option)}
		<option value={option}>{toLabel(option)}</option>
	{/each}
</select>
