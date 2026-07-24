// The project schema is the boundary that keeps a hostile or malformed Drive
// link out of the database. `drive_url` is rendered as an outbound anchor, so
// anything but https must be rejected before it is stored.

import { describe, expect, it } from "vitest";
import { projectInputSchema, projectPatchSchema, parseInput } from "./inputs";

const valid = { name: "Vadi Panorama" };

describe("projectInputSchema", () => {
	it("accepts a minimal project", () => {
		expect(parseInput(projectInputSchema, valid).name).toBe("Vadi Panorama");
	});

	it("requires a non-blank name", () => {
		expect(() => parseInput(projectInputSchema, { name: "   " })).toThrow();
		expect(() => parseInput(projectInputSchema, {})).toThrow();
	});

	it("accepts an https drive url", () => {
		const url = "https://drive.google.com/drive/folders/abc123";
		expect(parseInput(projectInputSchema, { ...valid, drive_url: url }).drive_url).toBe(url);
	});

	it("rejects non-https and malformed urls", () => {
		for (const drive_url of [
			"javascript:alert(1)",
			"http://drive.google.com/insecure",
			"data:text/html,<script>",
			"drive.google.com/no-scheme",
			"not a url at all",
		]) {
			expect(() => parseInput(projectInputSchema, { ...valid, drive_url })).toThrow();
		}
	});

	it("treats an empty drive url as omitted", () => {
		expect(() => parseInput(projectInputSchema, { ...valid, drive_url: "" })).not.toThrow();
		expect(() => parseInput(projectInputSchema, { ...valid, drive_url: null })).not.toThrow();
	});

	it("rejects a negative starting price", () => {
		expect(() => parseInput(projectInputSchema, { ...valid, price_from: -1 })).toThrow();
		expect(parseInput(projectInputSchema, { ...valid, price_from: 0 }).price_from).toBe(0);
	});

	it("rejects a currency that is not a 3-letter code", () => {
		expect(() => parseInput(projectInputSchema, { ...valid, price_currency: "TL" })).toThrow();
		expect(parseInput(projectInputSchema, { ...valid, price_currency: "USD" }).price_currency).toBe("USD");
	});
});

describe("projectPatchSchema", () => {
	it("allows partial updates without a name", () => {
		expect(parseInput(projectPatchSchema, { city: "İzmir" }).city).toBe("İzmir");
	});

	it("still enforces the https rule on a patched url", () => {
		expect(() => parseInput(projectPatchSchema, { drive_url: "javascript:alert(1)" })).toThrow();
	});
});
