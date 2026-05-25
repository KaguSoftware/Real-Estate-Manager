/**
 * Resolve `{placeholder}` tokens in `template` against `vars`.
 * Unknown / missing keys are left in place so it's obvious in the
 * rendered PDF that a value didn't get plumbed through.
 */
export function interpolate(
	template: string,
	vars: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (_m, key) => {
		const v = vars[key];
		return v === undefined || v === null ? `{${key}}` : String(v);
	});
}
