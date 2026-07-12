// Builds the {placeholder} → value map used to interpolate clause templates.
// Single source of truth for both render paths: the static PDF sections
// (sections/rental.tsx, sections/sales.tsx) and the editor's initial document
// (buildInitialDoc.ts). React-pdf-free.

import {
	RENTAL_NOTICE_DAYS,
	SUBLETTING_CLAUSES,
	RENT_INCREASE_DEFAULT_CLAUSE,
	UTILITY_RESP_LABELS,
	UTILITY_NAMES,
} from "@/src/lib/pdf/rentalClauses";
import { TAX_RESPONSIBILITY_CLAUSES } from "@/src/lib/pdf/salesClauses";
import type { RentalPDFData, SalesPDFData } from "@/src/lib/pdf/types";
import { docDate, docMoney } from "./format";

export function utilitiesSummary(utilities: RentalPDFData["utilities"]): string {
	return (Object.keys(UTILITY_NAMES) as (keyof typeof UTILITY_NAMES)[])
		.map((k) => `${UTILITY_NAMES[k]}: ${UTILITY_RESP_LABELS[utilities[k]]}`)
		.join("; ") + ".";
}

export function buildRentalClauseVars(data: RentalPDFData): Record<string, string | number> {
	const { lease, utilities, subletting_allowed, rent_increase_note } = data;
	return {
		monthly_rent: docMoney(lease.monthly_rent),
		deposit: docMoney(lease.deposit),
		currency: lease.currency,
		start_date: docDate(lease.start_date),
		payment_day: lease.payment_day ?? 1,
		notice_days: RENTAL_NOTICE_DAYS,
		utilities_summary: utilitiesSummary(utilities),
		subletting_clause: SUBLETTING_CLAUSES[subletting_allowed ? "true" : "false"],
		rent_increase_clause:
			rent_increase_note && rent_increase_note.trim()
				? rent_increase_note.trim()
				: RENT_INCREASE_DEFAULT_CLAUSE,
	};
}

export function buildSalesClauseVars(
	data: SalesPDFData,
	agencyName: string,
): Record<string, string | number> {
	const { sale, property } = data;
	return {
		sale_price: docMoney(sale.sale_price),
		currency: sale.currency,
		penalty_amount: sale.penalty_amount != null ? docMoney(sale.penalty_amount) : "...",
		deposit_amount: sale.deposit_amount != null ? docMoney(sale.deposit_amount) : "...",
		target_close_date: sale.target_close_date ? docDate(sale.target_close_date) : "...",
		validity_days: sale.validity_days ?? "...",
		tax_responsibility_clause: TAX_RESPONSIBILITY_CLAUSES[sale.tax_responsibility],
		agency_name: agencyName.toLocaleUpperCase("tr"),
		jurisdiction_city: (property.city && property.city.trim()) || "İstanbul",
	};
}
