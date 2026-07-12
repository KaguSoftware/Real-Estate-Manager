// Shared builder for the rent-receipt (kira makbuzu) PDF payload.
// Used by PropertyDetail's per-payment receipt action and the /documents/new
// receipt wizard so both flows produce byte-identical receipts.

import type { ReceiptPDFData } from "./types";
import type { Lease, Payment, Property, Tenant } from "@/src/lib/db/types";

export function buildReceiptPDFData(
	property: Pick<Property, "homeowner_name" | "address_line" | "city">,
	lease: Pick<Lease, "currency">,
	tenant: Pick<Tenant, "full_name">,
	payment: Payment,
): ReceiptPDFData {
	return {
		landlord_name: property.homeowner_name,
		tenant_name: tenant.full_name,
		property_address: property.address_line,
		city: property.city,
		period_start: payment.period_start,
		period_end: payment.period_end,
		amount: Number(payment.amount_paid),
		currency: lease.currency,
		method: payment.method,
		paid_at: payment.paid_at,
		generatedAt: new Date().toISOString(),
	};
}

/** Filename convention shared by both receipt entry points. */
export function receiptFilename(payment: Pick<Payment, "period_start">): string {
	return `makbuz-${payment.period_start}`;
}
