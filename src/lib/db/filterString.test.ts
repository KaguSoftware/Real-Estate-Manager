import { describe, expect, it } from "vitest";
import { ilikeContains, orIlikeAnyColumn, orIlikeAnyValue, pgrestLiteral } from "./filterString";

describe("pgrestLiteral", () => {
	it("quotes plain values", () => {
		expect(pgrestLiteral("kadıköy")).toBe('"kadıköy"');
	});
	it("keeps commas and parens inert inside quotes", () => {
		expect(pgrestLiteral("a,b)")).toBe('"a,b)"');
	});
	it("escapes embedded quotes and backslashes", () => {
		expect(pgrestLiteral('say "hi"')).toBe('"say \\"hi\\""');
		expect(pgrestLiteral("back\\slash")).toBe('"back\\\\slash"');
	});
});

describe("ilikeContains", () => {
	it("wraps the needle in wildcards", () => {
		expect(ilikeContains("merkez")).toBe('"%merkez%"');
	});
	it("escapes LIKE wildcards so they match literally", () => {
		// The LIKE-escape backslash is itself doubled for PostgREST's quoted-
		// value syntax, so Postgres ultimately sees %100\%% (a literal %).
		expect(ilikeContains("100%")).toBe('"%100\\\\%%"');
		expect(ilikeContains("a_b")).toBe('"%a\\\\_b%"');
	});
});

describe("orIlikeAnyColumn", () => {
	it("builds one clause per column", () => {
		expect(orIlikeAnyColumn(["city", "mahalle"], "izmir")).toBe(
			'city.ilike."%izmir%",mahalle.ilike."%izmir%"',
		);
	});
	it("neutralizes injection attempts", () => {
		const out = orIlikeAnyColumn(["full_name"], "x,phone.eq.5)");
		expect(out).toBe('full_name.ilike."%x,phone.eq.5)%"');
	});
});

describe("orIlikeAnyValue", () => {
	it("crosses needles with columns", () => {
		expect(orIlikeAnyValue(["nitelik"], ["2+1", "3+1"])).toBe(
			'nitelik.ilike."%2+1%",nitelik.ilike."%3+1%"',
		);
	});
});
