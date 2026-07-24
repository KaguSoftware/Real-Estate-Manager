// Emlak commission maths — the single source of truth.
//
// An agency's fee is a percentage of the sale price (the "matrah"), plus KDV on
// that fee. Both the buyer and the seller side may be charged.

import type { Sale } from "./db/types";

/**
 * Turkish VAT on the agency's commission.
 *
 * Raised from 18 % to 20 % by Presidential Decree 7346, effective 10 July 2023.
 * This number prints on client-facing sales contracts, so it must not drift:
 * change it here only, never inline.
 */
export const KDV_RATE = 0.20;

export interface CommissionLine {
	/** Percentage, e.g. 2 = 2 %. */
	rate: number | null;
	/** Fee before tax: salePrice * rate / 100. */
	matrah: number | null;
	kdv: number | null;
	total: number | null;
}

const EMPTY: CommissionLine = { rate: null, matrah: null, kdv: null, total: null };

/**
 * One side's commission. A missing rate or a zero price yields all-nulls rather
 * than zeros, so the PDF renders "—" instead of a misleading "0,00 TL".
 */
export function computeCommission(salePrice: number, rate: number | null): CommissionLine {
	if (!rate || !salePrice) return { ...EMPTY, rate: rate ?? null };
	const matrah = (salePrice * rate) / 100;
	const kdv = matrah * KDV_RATE;
	return { rate, matrah, kdv, total: matrah + kdv };
}

/** Buyer + seller commission for one sale, and their combined total. */
export function saleCommission(sale: Pick<Sale,
	"sale_price" | "buyer_commission_rate" | "seller_commission_rate">
): { buyer: CommissionLine; seller: CommissionLine; totalWithKdv: number } {
	const price = Number(sale.sale_price ?? 0);
	const buyer = computeCommission(price, sale.buyer_commission_rate);
	const seller = computeCommission(price, sale.seller_commission_rate);
	return {
		buyer,
		seller,
		totalWithKdv: (buyer.total ?? 0) + (seller.total ?? 0),
	};
}

export interface CommissionTotals {
	/** Fee before tax. */
	matrah: number;
	kdv: number;
	total: number;
	/** How many sales contributed. */
	count: number;
}

export interface CommissionSummary {
	/** Closed sales — money actually earned. Keyed by currency. */
	earned: Record<string, CommissionTotals>;
	/** Active sales — the pipeline, not yet banked. Keyed by currency. */
	pipeline: Record<string, CommissionTotals>;
}

type SummarisableSale = Pick<Sale,
	"sale_price" | "currency" | "status" | "buyer_commission_rate" | "seller_commission_rate">;

function addInto(
	bucket: Record<string, CommissionTotals>,
	currency: string,
	line: { matrah: number; kdv: number; total: number },
) {
	const key = (currency || "TRY").toUpperCase();
	const cur = bucket[key] ?? { matrah: 0, kdv: 0, total: 0, count: 0 };
	bucket[key] = {
		matrah: cur.matrah + line.matrah,
		kdv: cur.kdv + line.kdv,
		total: cur.total + line.total,
		count: cur.count + 1,
	};
}

/**
 * Aggregate commission across sales, split into earned (closed) vs pipeline
 * (active) and grouped by currency.
 *
 * Currencies are NEVER summed together: there is no FX conversion anywhere in
 * this product (rentals are usually TRY, sales often USD), so adding a USD
 * commission to a TRY one would produce a meaningless number.
 * Cancelled sales are excluded entirely.
 */
export function summariseCommissions(sales: SummarisableSale[]): CommissionSummary {
	const earned: Record<string, CommissionTotals> = {};
	const pipeline: Record<string, CommissionTotals> = {};

	for (const sale of sales) {
		if (sale.status === "cancelled") continue;
		const { buyer, seller } = saleCommission(sale);
		const matrah = (buyer.matrah ?? 0) + (seller.matrah ?? 0);
		if (matrah === 0) continue; // no commission agreed on this sale
		const kdv = (buyer.kdv ?? 0) + (seller.kdv ?? 0);
		const bucket = sale.status === "closed" ? earned : pipeline;
		addInto(bucket, sale.currency, { matrah, kdv, total: matrah + kdv });
	}

	return { earned, pipeline };
}
