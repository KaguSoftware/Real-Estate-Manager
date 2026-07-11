/**
 * Tiny dependency-free field validators. Each returns an error message or
 * undefined, so callers can build a Record<field, string> errors object:
 *
 *   const errors: Record<string, string> = {};
 *   const e = required(name, "Name"); if (e) errors.name = e;
 */

export function required(value: string, label: string): string | undefined {
	return value.trim() ? undefined : `${label} zorunludur.`;
}

export function positiveNumber(value: string, label: string): string | undefined {
	if (!value.trim()) return `${label} zorunludur.`;
	const n = Number(value);
	if (!Number.isFinite(n)) return `${label} sayı olmalıdır.`;
	if (n <= 0) return `${label} sıfırdan büyük olmalıdır.`;
	return undefined;
}

export function validEmail(value: string): string | undefined {
	if (!value.trim()) return undefined; // optional field — pair with required() when mandatory
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? undefined : "Geçerli bir e-posta adresi girin.";
}

export function isoDate(value: string, label: string): string | undefined {
	if (!value.trim()) return `${label} zorunludur.`;
	return Number.isNaN(Date.parse(value)) ? `${label} geçerli bir tarih olmalıdır.` : undefined;
}

/** end must be strictly after start (both ISO date strings). */
export function dateRange(start: string, end: string): string | undefined {
	if (!start || !end) return undefined;
	return Date.parse(end) > Date.parse(start) ? undefined : "Bitiş tarihi başlangıç tarihinden sonra olmalıdır.";
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
