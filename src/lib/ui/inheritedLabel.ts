/** The label for an unset control: the value the scope inherits when there is one, otherwise the fallback, such as `Not set`. */
export function toUnsetLabel(inheritedValue: string | undefined, fallback: string): string {
	return inheritedValue === undefined ? fallback : `Inherited (${inheritedValue})`;
}
