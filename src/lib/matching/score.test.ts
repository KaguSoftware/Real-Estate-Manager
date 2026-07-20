import { describe, expect, it } from "vitest";
import { rankLeadsForProperty, scoreLeadProperty } from "./score";
import type { Lead, Property } from "@/src/lib/db/types";

function lead(overrides: Partial<Lead> = {}): Lead {
	return {
		id: "lead1",
		full_name: "Test Lead",
		status: "new",
		pref_listing_type: null,
		pref_nitelik: null,
		pref_min_bedrooms: null,
		pref_location: null,
		pref_min_price: null,
		pref_max_price: null,
		pref_currency: "TRY",
		...overrides,
	} as Lead;
}

function property(overrides: Partial<Property> = {}): Property {
	return {
		id: "prop1",
		listing_type: "for_rent",
		status: "vacant",
		nitelik: "3+1",
		bedrooms: 3,
		city: "İzmir",
		mahalle: "Alsancak",
		mevkii: null,
		address_line: "Kıbrıs Şehitleri Cd. 10",
		list_price: 5_000_000,
		currency: "TRY",
		...overrides,
	} as Property;
}

describe("scoreLeadProperty", () => {
	it("scores 0 for leads with no preferences", () => {
		expect(scoreLeadProperty(lead(), property()).score).toBe(0);
	});

	it("scores 0 for closed-pipeline leads", () => {
		const l = lead({ status: "converted" as Lead["status"], pref_nitelik: "3+1" });
		expect(scoreLeadProperty(l, property()).score).toBe(0);
	});

	it("hard-fails on listing type mismatch", () => {
		const l = lead({ pref_listing_type: "for_sale" });
		expect(scoreLeadProperty(l, property({ listing_type: "for_rent" })).score).toBe(0);
	});

	it("gives full nitelik credit for exact match, partial for substring", () => {
		const exact = scoreLeadProperty(lead({ pref_nitelik: "3+1" }), property());
		expect(exact.score).toBe(3);
		expect(exact.reasons).toContain("3+1");

		const partial = scoreLeadProperty(
			lead({ pref_nitelik: "3+1" }),
			property({ nitelik: "3+1 dubleks" }),
		);
		expect(partial.score).toBe(2);
	});

	it("hard-fails when bedrooms below preference or unknown", () => {
		const l = lead({ pref_min_bedrooms: 4 });
		expect(scoreLeadProperty(l, property({ bedrooms: 3 })).score).toBe(0);
		expect(scoreLeadProperty(l, property({ bedrooms: null })).score).toBe(0);
		expect(scoreLeadProperty(l, property({ bedrooms: 4 })).score).toBe(2);
	});

	it("matches location case-insensitively with Turkish locale", () => {
		const l = lead({ pref_location: "alsancak" });
		expect(scoreLeadProperty(l, property()).score).toBe(2);
		const lUpper = lead({ pref_location: "İZMİR" });
		expect(scoreLeadProperty(lUpper, property()).score).toBe(2);
	});

	describe("budget", () => {
		it("scores a property inside a stated range", () => {
			const l = lead({ pref_min_price: 4_000_000, pref_max_price: 6_000_000 });
			const r = scoreLeadProperty(l, property());
			expect(r.score).toBe(3);
			expect(r.reasons).toContain("bütçe içinde");
		});

		it("hard-fails below the minimum and above the maximum", () => {
			const l = lead({ pref_min_price: 6_000_000 });
			expect(scoreLeadProperty(l, property({ list_price: 5_000_000 })).score).toBe(0);

			const l2 = lead({ pref_max_price: 4_000_000 });
			expect(scoreLeadProperty(l2, property({ list_price: 5_000_000 })).score).toBe(0);
		});

		it("treats each bound as open-ended when only one is set", () => {
			const onlyMin = lead({ pref_min_price: 1_000_000 });
			expect(scoreLeadProperty(onlyMin, property()).score).toBe(3);

			const onlyMax = lead({ pref_max_price: 9_000_000 });
			expect(scoreLeadProperty(onlyMax, property()).score).toBe(3);
		});

		it("includes the range bounds themselves", () => {
			const l = lead({ pref_min_price: 5_000_000, pref_max_price: 5_000_000 });
			expect(scoreLeadProperty(l, property({ list_price: 5_000_000 })).score).toBe(3);
		});

		// There is no FX conversion in the product: a 400,000 USD budget must never
		// be compared against a TRY price. The dimension is skipped, not failed.
		it("skips the budget dimension on a currency mismatch", () => {
			const l = lead({
				pref_min_price: 400_000,
				pref_max_price: 500_000,
				pref_currency: "USD",
				pref_nitelik: "3+1",
			});
			const r = scoreLeadProperty(l, property({ list_price: 5_000_000, currency: "TRY" }));
			// nitelik still scores; budget contributes nothing and does not zero the match.
			expect(r.score).toBe(3);
			expect(r.reasons).not.toContain("bütçe içinde");
		});

		it("skips the budget dimension for an unpriced property", () => {
			const l = lead({ pref_max_price: 1_000, pref_nitelik: "3+1" });
			const r = scoreLeadProperty(l, property({ list_price: null }));
			expect(r.score).toBe(3);
			expect(r.reasons).not.toContain("bütçe içinde");
		});

		it("matches a lead whose only stated preference is a budget", () => {
			const l = lead({ pref_max_price: 6_000_000 });
			expect(scoreLeadProperty(l, property()).score).toBe(3);
		});
	});

	it("accumulates score across matched preferences", () => {
		const l = lead({
			pref_listing_type: "for_rent",
			pref_nitelik: "3+1",
			pref_min_bedrooms: 3,
			pref_location: "İzmir",
		});
		const r = scoreLeadProperty(l, property());
		expect(r.score).toBe(9);
		expect(r.reasons).toHaveLength(4);
	});
});

describe("rankLeadsForProperty", () => {
	it("filters non-matches and sorts best first", () => {
		const weak = lead({ id: "weak", pref_location: "İzmir" });
		const strong = lead({ id: "strong", pref_nitelik: "3+1", pref_min_bedrooms: 3 });
		const none = lead({ id: "none" });
		const out = rankLeadsForProperty([weak, none, strong], property());
		expect(out.map((m) => m.lead.id)).toEqual(["strong", "weak"]);
	});
});
