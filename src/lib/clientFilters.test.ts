import { describe, it, expect } from "vitest";
import { filterProperties } from "./clientFilters";
import type { Property } from "./db/types";

function prop(over: Partial<Property> = {}): Property {
	return {
		id: "1", team_id: "t", created_by: null, assigned_to: null,
		homeowner_name: "Ahmet Yılmaz", address_line: "Bağdat Caddesi 12", city: "İstanbul",
		size_sqm: 100, bedrooms: 2, bathrooms: 1, furnished: false,
		listing_type: "for_sale", status: "vacant", list_price: 1_000_000, currency: "TRY",
		notes: null, nitelik: "Mesken", ada_no: null, parsel_no: null,
		mahalle: "Caddebostan", mevkii: null, latitude: null, longitude: null,
		project_id: null, is_new_build: false,
		created_at: "2026-01-01", updated_at: "2026-01-01",
		...over,
	} as Property;
}

describe("filterProperties", () => {
	it("returns everything when no filter is set", () => {
		const rows = [prop({ id: "a" }), prop({ id: "b" })];
		expect(filterProperties(rows, {})).toHaveLength(2);
	});

	it("preserves input order (the server's updated_at sort still governs)", () => {
		const rows = [prop({ id: "a" }), prop({ id: "b" }), prop({ id: "c" })];
		expect(filterProperties(rows, {}).map((p) => p.id)).toEqual(["a", "b", "c"]);
	});

	it("matches status and listing_type exactly", () => {
		const rows = [prop({ id: "a", status: "vacant" }), prop({ id: "b", status: "sold" })];
		expect(filterProperties(rows, { status: "sold" }).map((p) => p.id)).toEqual(["b"]);
		expect(filterProperties(rows, { listing_type: "for_rent" })).toHaveLength(0);
	});

	describe("free-text search", () => {
		it("spans owner, address and city", () => {
			const rows = [
				prop({ id: "owner", homeowner_name: "Zeynep Kaya" }),
				prop({ id: "addr", address_line: "Nispetiye Sokak 4" }),
				prop({ id: "city", city: "Ankara" }),
			];
			expect(filterProperties(rows, { q: "zeynep" }).map((p) => p.id)).toEqual(["owner"]);
			expect(filterProperties(rows, { q: "nispetiye" }).map((p) => p.id)).toEqual(["addr"]);
			expect(filterProperties(rows, { q: "ankara" }).map((p) => p.id)).toEqual(["city"]);
		});

		it("is case-insensitive the Turkish way (İstanbul matches istanbul)", () => {
			// The reason this needs a locale-aware lowercase: JS's default
			// toLowerCase turns "İ" into "i̇" (i + combining dot), which then fails
			// a plain includes("istanbul"). A Turkish agent typing lowercase must
			// still find their own city.
			const rows = [prop({ id: "ist", city: "İSTANBUL" })];
			expect(filterProperties(rows, { q: "istanbul" }).map((p) => p.id)).toEqual(["ist"]);
		});

		it("treats the needle as a literal, not a wildcard", () => {
			// The server escapes LIKE metacharacters (escapeLike) so "100%" is
			// literal. Client-side substring matching is literal by nature; this
			// pins that the two agree.
			const rows = [prop({ id: "a", address_line: "100% renovated" }), prop({ id: "b", address_line: "anything" })];
			expect(filterProperties(rows, { q: "100%" }).map((p) => p.id)).toEqual(["a"]);
		});

		it("ignores surrounding whitespace", () => {
			const rows = [prop({ id: "a", homeowner_name: "Ahmet Yılmaz" })];
			expect(filterProperties(rows, { q: "  ahmet  " }).map((p) => p.id)).toEqual(["a"]);
		});
	});

	describe("price bounds", () => {
		it("applies min and max inclusively", () => {
			const rows = [
				prop({ id: "low", list_price: 500_000 }),
				prop({ id: "mid", list_price: 1_000_000 }),
				prop({ id: "high", list_price: 2_000_000 }),
			];
			expect(filterProperties(rows, { min_price: 1_000_000 }).map((p) => p.id)).toEqual(["mid", "high"]);
			expect(filterProperties(rows, { max_price: 1_000_000 }).map((p) => p.id)).toEqual(["low", "mid"]);
		});

		it("excludes null prices when a bound is set", () => {
			// Postgres drops NULLs from >= / <= comparisons; Number(null) is 0 in
			// JS, which would WRONGLY pass a min filter. This pins the SQL
			// behaviour: a property with no price is not "cheap", it is unknown.
			const rows = [prop({ id: "priced", list_price: 900_000 }), prop({ id: "nulled", list_price: null })];
			expect(filterProperties(rows, { min_price: 1 }).map((p) => p.id)).toEqual(["priced"]);
			expect(filterProperties(rows, { max_price: 5_000_000 }).map((p) => p.id)).toEqual(["priced"]);
		});

		it("scopes a range to one currency", () => {
			const rows = [
				prop({ id: "try", list_price: 1_000_000, currency: "TRY" }),
				prop({ id: "usd", list_price: 1_000_000, currency: "USD" }),
			];
			expect(filterProperties(rows, { min_price: 1, currency: "TRY" }).map((p) => p.id)).toEqual(["try"]);
		});
	});

	describe("multi-value groups", () => {
		it("ORs within nitelik", () => {
			const rows = [
				prop({ id: "mesken", nitelik: "Mesken" }),
				prop({ id: "arsa", nitelik: "Arsa" }),
				prop({ id: "dukkan", nitelik: "Dükkan" }),
			];
			expect(filterProperties(rows, { nitelik: ["Mesken", "Arsa"] }).map((p) => p.id)).toEqual(["mesken", "arsa"]);
		});

		it("matches location against city, mahalle or mevkii", () => {
			const rows = [
				prop({ id: "byCity", city: "Bursa", mahalle: null, mevkii: null }),
				prop({ id: "byMahalle", city: "İzmir", mahalle: "Alsancak", mevkii: null }),
				prop({ id: "byMevkii", city: "İzmir", mahalle: null, mevkii: "Karşıyaka" }),
				prop({ id: "none", city: "Adana", mahalle: null, mevkii: null }),
			];
			expect(filterProperties(rows, { location: ["Bursa", "Alsancak", "Karşıyaka"] }).map((p) => p.id))
				.toEqual(["byCity", "byMahalle", "byMevkii"]);
		});

		it("ignores blank entries so an empty chip never hides rows", () => {
			const rows = [prop({ id: "a" })];
			expect(filterProperties(rows, { nitelik: ["  ", ""] })).toHaveLength(1);
			expect(filterProperties(rows, { location: [""] })).toHaveLength(1);
		});
	});

	it("ANDs across groups (search AND location, like PostgREST)", () => {
		// Two separate .or() groups are AND-combined server-side; a row must
		// satisfy both, not either.
		const rows = [
			prop({ id: "both", homeowner_name: "Ayşe", city: "Bursa" }),
			prop({ id: "onlyName", homeowner_name: "Ayşe", city: "Adana" }),
			prop({ id: "onlyCity", homeowner_name: "Mehmet", city: "Bursa" }),
		];
		expect(filterProperties(rows, { q: "Ayşe", location: ["Bursa"] }).map((p) => p.id)).toEqual(["both"]);
	});

	it("distinguishes furnished false from unset", () => {
		// furnished is a tri-state (null = unknown). Filtering for "unfurnished"
		// must not sweep in the unknowns.
		const rows = [
			prop({ id: "yes", furnished: true }),
			prop({ id: "no", furnished: false }),
			prop({ id: "unknown", furnished: null }),
		];
		expect(filterProperties(rows, { furnished: false }).map((p) => p.id)).toEqual(["no"]);
		expect(filterProperties(rows, { furnished: true }).map((p) => p.id)).toEqual(["yes"]);
		expect(filterProperties(rows, {})).toHaveLength(3);
	});

	it("does not mutate the input array", () => {
		const rows = [prop({ id: "a", status: "sold" }), prop({ id: "b" })];
		filterProperties(rows, { status: "vacant" });
		expect(rows).toHaveLength(2);
	});
});
