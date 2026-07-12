import { describe, expect, it } from "vitest";
import { defaultClauses, resolveClauseTemplates } from "./clauses";
import { findUnknownTokens } from "./placeholders";
import { interpolate } from "@/src/lib/pdf/interpolate";
import { RENTAL_STANDARD_CLAUSES } from "@/src/lib/pdf/rentalClauses";
import { SALES_STANDARD_CLAUSES } from "@/src/lib/pdf/salesClauses";

describe("resolveClauseTemplates", () => {
	it("falls back to built-in defaults when no team template exists", () => {
		expect(resolveClauseTemplates("rental", null)).toEqual(RENTAL_STANDARD_CLAUSES);
		expect(resolveClauseTemplates("sales", undefined)).toEqual(SALES_STANDARD_CLAUSES);
	});

	it("falls back when the team template is empty or all-blank", () => {
		expect(resolveClauseTemplates("rental", [])).toEqual(RENTAL_STANDARD_CLAUSES);
		expect(resolveClauseTemplates("rental", ["", "   "])).toEqual(RENTAL_STANDARD_CLAUSES);
	});

	it("uses the team template when present, trimming and dropping blanks", () => {
		const team = ["  Madde bir {monthly_rent} {currency}.  ", "", "Madde iki."];
		expect(resolveClauseTemplates("rental", team)).toEqual([
			"Madde bir {monthly_rent} {currency}.",
			"Madde iki.",
		]);
	});

	it("defaultClauses returns copies, not the shared arrays", () => {
		const a = defaultClauses("rental");
		a.push("mutated");
		expect(RENTAL_STANDARD_CLAUSES).not.toContain("mutated");
	});
});

describe("standard clauses are de-hardcoded", () => {
	it("sales defaults reference {agency_name} instead of a literal agency", () => {
		const joined = SALES_STANDARD_CLAUSES.join(" ");
		expect(joined).not.toMatch(/AVERA/);
		expect(joined).toContain("{agency_name}");
		expect(joined).toContain("{jurisdiction_city}");
	});

	it("every token used in the defaults is in the placeholder catalog", () => {
		for (const c of RENTAL_STANDARD_CLAUSES) {
			expect(findUnknownTokens("rental", c)).toEqual([]);
		}
		for (const c of SALES_STANDARD_CLAUSES) {
			expect(findUnknownTokens("sales", c)).toEqual([]);
		}
	});
});

describe("findUnknownTokens", () => {
	it("flags tokens not in the catalog and ignores known ones", () => {
		expect(findUnknownTokens("rental", "Kira {monthly_rent} {tipo} {foo}")).toEqual([
			"tipo",
			"foo",
		]);
	});

	it("returns empty for token-free text", () => {
		expect(findUnknownTokens("sales", "Düz metin.")).toEqual([]);
	});
});

describe("interpolate (template contract)", () => {
	it("resolves known vars and leaves unknown tokens visible", () => {
		expect(interpolate("Kira {monthly_rent} {currency} — {unknown}", {
			monthly_rent: "25.000",
			currency: "TRY",
		})).toBe("Kira 25.000 TRY — {unknown}");
	});
});
