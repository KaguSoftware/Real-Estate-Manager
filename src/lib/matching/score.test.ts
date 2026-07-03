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
