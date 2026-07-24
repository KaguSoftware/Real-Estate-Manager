// Turkish matching is dotted-i sensitive: "İstanbul".toLowerCase() yields
// "i̇stanbul" (i + combining dot) in most locales, which never equals a typed
// "i". These lock the folding that makes the city combobox actually findable.

import { describe, expect, it } from "vitest";
import { TURKEY_PROVINCES, foldTr } from "./turkeyGeo";

const match = (query: string) =>
	TURKEY_PROVINCES.filter((p) => foldTr(p).includes(foldTr(query)));

describe("TURKEY_PROVINCES", () => {
	it("has all 81 provinces, with no duplicates", () => {
		expect(TURKEY_PROVINCES).toHaveLength(81);
		expect(new Set(TURKEY_PROVINCES).size).toBe(81);
	});
});

describe("foldTr", () => {
	it("folds dotted and dotless i to a plain i", () => {
		expect(foldTr("İstanbul")).toBe("istanbul");
		expect(foldTr("ISTANBUL")).toBe("istanbul");
		expect(foldTr("Iğdır")).toBe("igdir");
	});

	it("strips Turkish accents", () => {
		expect(foldTr("Şanlıurfa")).toBe("sanliurfa");
		expect(foldTr("Çorum")).toBe("corum");
		expect(foldTr("Muğla")).toBe("mugla");
		expect(foldTr("Nevşehir")).toBe("nevsehir");
		expect(foldTr("Hakkâri")).toBe("hakkari");
	});
});

describe("province search", () => {
	it("finds İstanbul and İzmir from unaccented lowercase input", () => {
		expect(match("istanbul")).toContain("İstanbul");
		expect(match("izmir")).toContain("İzmir");
		expect(match("IZMIR")).toContain("İzmir");
	});

	it("finds accented provinces typed without accents", () => {
		expect(match("sanliurfa")).toContain("Şanlıurfa");
		expect(match("mugla")).toContain("Muğla");
		expect(match("corum")).toContain("Çorum");
		expect(match("kahramanmaras")).toContain("Kahramanmaraş");
	});

	it("matches on a partial prefix", () => {
		expect(match("anka")).toEqual(["Ankara"]);
		expect(match("bur")).toEqual(expect.arrayContaining(["Burdur", "Bursa"]));
	});

	it("returns nothing for a non-province", () => {
		expect(match("Alsancak")).toEqual([]);
	});
});
