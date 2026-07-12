// Pure formatting helpers for generated documents (react-pdf-free so the
// editor, the initial-doc builder and the PDF sections can all share them).

/** Turkish long-form date, e.g. "12 Temmuz 2026". */
export function docDate(iso?: string): string {
	const d = iso ? new Date(iso) : new Date();
	return d.toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" });
}

/** Turkish grouped number for contract amounts: 1.250.000,5 (no currency). */
export function docMoney(n: number | null | undefined): string {
	return (n == null ? 0 : n).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}
