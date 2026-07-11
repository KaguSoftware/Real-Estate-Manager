import { describe, expect, it } from "vitest";
import {
	classifyLeads,
	classifyLeases,
	classifyPayments,
	type LeadRow,
	type LeaseEndRow,
	type PaymentRow,
} from "./attentionLogic";

const NOW = new Date("2026-07-03T00:00:00Z");
const TODAY = "2026-07-03";

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
	return {
		id: "p1",
		period_start: "2026-06-01",
		period_end: "2026-06-30",
		amount_due: 1000,
		amount_paid: 0,
		lease: {
			id: "l1",
			status: "active",
			currency: "TRY",
			property_id: "prop1",
			property: { id: "prop1", address_line: "Test Sk. 1", homeowner_name: "Owner" },
		},
		...overrides,
	};
}

describe("classifyPayments", () => {
	it("splits overdue vs upcoming by period_end", () => {
		const rows = [
			paymentRow({ id: "past", period_end: "2026-06-30" }),
			paymentRow({ id: "future", period_end: "2026-07-05" }),
		];
		const { overduePayments, upcomingPayments } = classifyPayments(rows, TODAY);
		expect(overduePayments.map((p) => p.paymentId)).toEqual(["past"]);
		expect(upcomingPayments.map((p) => p.paymentId)).toEqual(["future"]);
	});

	it("skips settled payments and non-active leases", () => {
		const rows = [
			paymentRow({ id: "paid", amount_paid: 1000 }),
			paymentRow({
				id: "ended",
				lease: { ...paymentRow().lease!, status: "ended" },
			}),
			paymentRow({ id: "orphan", lease: null }),
		];
		const { overduePayments, upcomingPayments } = classifyPayments(rows, TODAY);
		expect(overduePayments).toHaveLength(0);
		expect(upcomingPayments).toHaveLength(0);
	});

	it("computes outstanding as due minus paid, sorted by period end", () => {
		const rows = [
			paymentRow({ id: "b", period_end: "2026-06-20", amount_paid: 400 }),
			paymentRow({ id: "a", period_end: "2026-06-10" }),
		];
		const { overduePayments } = classifyPayments(rows, TODAY);
		expect(overduePayments.map((p) => p.paymentId)).toEqual(["a", "b"]);
		expect(overduePayments[1].outstanding).toBe(600);
	});
});

describe("classifyLeases", () => {
	it("computes days left and sorts by end date", () => {
		const rows: LeaseEndRow[] = [
			{ id: "l2", end_date: "2026-07-20", property_id: "p2", property: null },
			{ id: "l1", end_date: "2026-07-10", property_id: "p1", property: null },
		];
		const out = classifyLeases(rows, NOW);
		expect(out.map((l) => l.leaseId)).toEqual(["l1", "l2"]);
		expect(out[0].daysLeft).toBe(7);
		expect(out[0].propertyLabel).toBe("Bilinmeyen taşınmaz");
	});
});

describe("classifyLeads", () => {
	const lead = (id: string, lastCall: string | null, created = "2026-01-01"): LeadRow => ({
		id,
		full_name: id,
		status: "new",
		last_call_at: lastCall,
		created_at: created,
	});

	it("respects the silent-days threshold", () => {
		const out = classifyLeads(
			[lead("fresh", "2026-07-01"), lead("stale", "2026-06-01")],
			NOW,
			14,
		);
		expect(out.map((l) => l.leadId)).toEqual(["stale"]);
	});

	it("falls back to created_at when never called, sorted most-silent first", () => {
		const out = classifyLeads(
			[lead("never", null, "2026-05-01"), lead("older", "2026-06-10")],
			NOW,
			14,
		);
		expect(out.map((l) => l.leadId)).toEqual(["never", "older"]);
	});

	it("a lower threshold surfaces more leads", () => {
		const rows = [lead("recent", "2026-07-01")];
		expect(classifyLeads(rows, NOW, 14)).toHaveLength(0);
		expect(classifyLeads(rows, NOW, 1)).toHaveLength(1);
	});
});
