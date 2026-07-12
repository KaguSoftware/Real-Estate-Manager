import { describe, expect, it } from "vitest";
import {
	clamp,
	formatTrMoney,
	parseTrNumber,
	sanitizeNumericText,
	toEditingText,
} from "./numberFormat";

const int = { decimal: false, negative: false };
const dec = { decimal: true, negative: false };

describe("sanitizeNumericText", () => {
	it("keeps digits only in integer mode", () => {
		expect(sanitizeNumericText("12a3", int)).toBe("123");
		expect(sanitizeNumericText("1,5", int)).toBe("15");
		expect(sanitizeNumericText("-4", int)).toBe("4");
	});
	it("allows one decimal separator in decimal mode", () => {
		expect(sanitizeNumericText("12,5", dec)).toBe("12,5");
		expect(sanitizeNumericText("1,2,3", dec)).toBe("1,23");
	});
	it("treats dot-then-3-digits as thousands grouping", () => {
		expect(sanitizeNumericText("12.500", dec)).toBe("12500");
		expect(sanitizeNumericText("12.500,50", dec)).toBe("12500,50");
		expect(sanitizeNumericText("1.250.000", dec)).toBe("1250000");
	});
	it("treats other dots as decimal separator", () => {
		expect(sanitizeNumericText("12.5", dec)).toBe("12,5");
	});
	it("strips pasted junk", () => {
		expect(sanitizeNumericText("₺12.500,50 TL", dec)).toBe("12500,50");
	});
	it("allows leading minus only when negatives are allowed", () => {
		expect(sanitizeNumericText("-12", { decimal: false, negative: true })).toBe("-12");
		expect(sanitizeNumericText("1-2", { decimal: false, negative: true })).toBe("12");
	});
});

describe("parseTrNumber", () => {
	it("parses comma decimals", () => {
		expect(parseTrNumber("12,5")).toBe(12.5);
		expect(parseTrNumber("1250000")).toBe(1250000);
	});
	it("returns null for empty / partial states", () => {
		expect(parseTrNumber("")).toBeNull();
		expect(parseTrNumber("-")).toBeNull();
		expect(parseTrNumber(",")).toBeNull();
	});
});

describe("clamp", () => {
	it("clamps to bounds when given", () => {
		expect(clamp(0, 1, 28)).toBe(1);
		expect(clamp(99, 1, 28)).toBe(28);
		expect(clamp(15, 1, 28)).toBe(15);
		expect(clamp(-5, undefined, undefined)).toBe(-5);
	});
});

describe("formatTrMoney / toEditingText", () => {
	it("groups thousands with dots, comma decimals", () => {
		expect(formatTrMoney(12500.5)).toBe("12.500,5");
		expect(formatTrMoney(1250000)).toBe("1.250.000");
	});
	it("round-trips editing text", () => {
		expect(toEditingText(12.5)).toBe("12,5");
		expect(toEditingText(null)).toBe("");
		expect(parseTrNumber(toEditingText(1250000.25))).toBe(1250000.25);
	});
});
