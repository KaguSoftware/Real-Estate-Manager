// Shared money formatting. Uses tr-TR grouping (1.234.567,89) with the
// currency code displayed, e.g. "12.500,00 TRY" — consistent everywhere
// instead of the previous mix of toFixed and toLocaleString.

const formatters = new Map<string, Intl.NumberFormat>();

export function fmtMoney(amount: number, currency: string): string {
	const ccy = (currency || "TRY").toUpperCase();
	let fmt = formatters.get(ccy);
	if (!fmt) {
		try {
			fmt = new Intl.NumberFormat("tr-TR", {
				style: "currency",
				currency: ccy,
				currencyDisplay: "code",
			});
		} catch {
			// Unknown currency code — fall back to plain grouped number + code.
			fmt = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
			formatters.set(ccy, fmt);
			return `${fmt.format(amount)} ${ccy}`;
		}
		formatters.set(ccy, fmt);
	}
	return fmt.format(amount);
}

/** Grouped number without currency, e.g. "1.234" — for counts and sqm. */
export function fmtNumber(n: number): string {
	return new Intl.NumberFormat("tr-TR").format(n);
}
