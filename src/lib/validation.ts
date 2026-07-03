/**
 * Tiny dependency-free field validators. Each returns an error message or
 * undefined, so callers can build a Record<field, string> errors object:
 *
 *   const errors: Record<string, string> = {};
 *   const e = required(name, "Name"); if (e) errors.name = e;
 */

export function required(value: string, label: string): string | undefined {
	return value.trim() ? undefined : `${label} is required.`;
}

export function positiveNumber(value: string, label: string): string | undefined {
	if (!value.trim()) return `${label} is required.`;
	const n = Number(value);
	if (!Number.isFinite(n)) return `${label} must be a number.`;
	if (n <= 0) return `${label} must be greater than zero.`;
	return undefined;
}

export function validEmail(value: string): string | undefined {
	if (!value.trim()) return undefined; // optional field — pair with required() when mandatory
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? undefined : "Enter a valid email address.";
}

export function isoDate(value: string, label: string): string | undefined {
	if (!value.trim()) return `${label} is required.`;
	return Number.isNaN(Date.parse(value)) ? `${label} must be a valid date.` : undefined;
}

/** end must be strictly after start (both ISO date strings). */
export function dateRange(start: string, end: string): string | undefined {
	if (!start || !end) return undefined;
	return Date.parse(end) > Date.parse(start) ? undefined : "End date must be after the start date.";
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
	return Object.values(errors).some(Boolean);
}

/** Strip undefined values so `Object.keys(errors).length` is meaningful. */
export function compactErrors(errors: Record<string, string | undefined>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(errors)) if (v) out[k] = v;
	return out;
}
