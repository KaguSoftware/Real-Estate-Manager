// Commission prints on client-facing sales contracts, so the arithmetic and
// the KDV rate are pinned here. The rate was 18 % until Turkey raised it to
// 20 % on 10 July 2023; contracts generated before this fix understated it.

import { describe, expect, it } from "vitest";
import {
	KDV_RATE,
	computeCommission,
	saleCommission,
	summariseCommissions,
} from "./commission";
import type { Sale } from "./db/types";

const sale = (over: Partial<Sale> = {}): Sale =>
	({
		sale_price: 1_000_000,
		currency: "TRY",
		status: "closed",
		buyer_commission_rate: 2,
		seller_commission_rate: 2,
		...over,
	}) as Sale;

describe("KDV_RATE", () => {
	it("is 20 %, not the pre-2023 18 %", () => {
		expect(KDV_RATE).toBe(0.2);
	});
});

describe("computeCommission", () => {
	it("computes matrah, KDV and total at 20 %", () => {
		const line = computeCommission(1_000_000, 2);
		expect(line.matrah).toBe(20_000);
		expect(line.kdv).toBe(4_000);
		expect(line.total).toBe(24_000);
		expect(line.rate).toBe(2);
	});

	it("handles a fractional rate", () => {
		const line = computeCommission(2_500_000, 1.5);
		expect(line.matrah).toBe(37_500);
		expect(line.kdv).toBe(7_500);
		expect(line.total).toBe(45_000);
	});

	// Nulls (not zeros) so the PDF renders "—" rather than a misleading 0,00.
	it("returns nulls when the rate or price is missing", () => {
		expect(computeCommission(1_000_000, null).matrah).toBeNull();
		expect(computeCommission(1_000_000, 0).total).toBeNull();
		expect(computeCommission(0, 2).kdv).toBeNull();
	});
});

describe("saleCommission", () => {
	it("adds both sides", () => {
		const { buyer, seller, totalWithKdv } = saleCommission(sale());
		expect(buyer.total).toBe(24_000);
		expect(seller.total).toBe(24_000);
		expect(totalWithKdv).toBe(48_000);
	});

	it("counts only the side that has a rate", () => {
		const { totalWithKdv } = saleCommission(sale({ seller_commission_rate: null }));
		expect(totalWithKdv).toBe(24_000);
	});
});

describe("summariseCommissions", () => {
	it("splits closed (earned) from active (pipeline)", () => {
		const result = summariseCommissions([
			sale({ status: "closed" }),
			sale({ status: "active" }),
		]);
		expect(result.earned.TRY.total).toBe(48_000);
		expect(result.earned.TRY.count).toBe(1);
		expect(result.pipeline.TRY.total).toBe(48_000);
	});

	it("excludes cancelled sales entirely", () => {
		const result = summariseCommissions([sale({ status: "cancelled" })]);
		expect(result.earned).toEqual({});
		expect(result.pipeline).toEqual({});
	});

	// There is no FX conversion anywhere in the product.
	it("never sums different currencies together", () => {
		const result = summariseCommissions([
			sale({ currency: "TRY" }),
			sale({ currency: "USD", sale_price: 400_000 }),
		]);
		expect(Object.keys(result.earned).sort()).toEqual(["TRY", "USD"]);
		expect(result.earned.TRY.total).toBe(48_000);
		// 400k * 2 % = 8 000 per side, +20 % KDV = 9 600 each.
		expect(result.earned.USD.total).toBe(19_200);
	});

	it("skips sales with no commission agreed", () => {
		const result = summariseCommissions([
			sale({ buyer_commission_rate: null, seller_commission_rate: null }),
		]);
		expect(result.earned).toEqual({});
	});

	it("normalises the currency key", () => {
		const result = summariseCommissions([sale({ currency: "try" })]);
		expect(result.earned.TRY).toBeDefined();
	});
});
