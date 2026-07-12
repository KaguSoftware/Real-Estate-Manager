/**
 * Pure helpers behind <NumberInput/> — kept DOM-free so they're unit-testable.
 * Turkish conventions: "." thousands grouping, "," decimal separator.
 */

/** Strip everything that isn't part of a number; tolerate pasted junk like "₺12.500,50 TL". */
export function sanitizeNumericText(raw: string, opts: { decimal: boolean; negative: boolean }): string {
	let out = "";
	let hasSep = false;
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		if (ch >= "0" && ch <= "9") { out += ch; continue; }
		if (opts.negative && ch === "-" && out === "") { out += ch; continue; }
		if (opts.decimal && !hasSep && (ch === "," || ch === ".")) {
			// A "." followed by exactly 3 digits then end/another group reads as
			// thousands grouping (12.500 → 12500); otherwise treat as decimal sep.
			if (ch === "." && /^\d{3}(\D|$)/.test(raw.slice(i + 1))) continue;
			out += ",";
			hasSep = true;
		}
	}
	return out;
}

/** Parse sanitized text ("1234,5" / "-12") to a number; null when empty/invalid. */
export function parseTrNumber(text: string): number | null {
	const t = text.trim();
	if (!t || t === "-" || t === ",") return null;
	const n = Number(t.replace(",", "."));
	return Number.isFinite(n) ? n : null;
}

export function clamp(n: number, min?: number, max?: number): number {
	if (min !== undefined && n < min) return min;
	if (max !== undefined && n > max) return max;
	return n;
}

const trFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

/** 12500.5 → "12.500,5" — used for money display while the field is unfocused. */
export function formatTrMoney(n: number): string {
	return trFormat.format(n);
}

/** Number → the raw editing text shown while focused ("," as decimal sep). */
export function toEditingText(n: number | null): string {
	return n === null ? "" : String(n).replace(".", ",");
}
