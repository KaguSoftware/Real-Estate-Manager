import { describe, expect, it } from "vitest";
import {
	compactErrors,
	dateRange,
	hasErrors,
	isoDate,
	positiveNumber,
	required,
	validEmail,
} from "./validation";

describe("required", () => {
	it("rejects empty / whitespace", () => {
		expect(required("", "Name")).toBe("Name is required.");
		expect(required("   ", "Name")).toBe("Name is required.");
	});
	it("accepts non-empty", () => {
		expect(required("x", "Name")).toBeUndefined();
	});
});

describe("positiveNumber", () => {
	it("rejects empty, non-numeric, zero, negative", () => {
		expect(positiveNumber("", "Rent")).toBe("Rent is required.");
		expect(positiveNumber("abc", "Rent")).toBe("Rent must be a number.");
		expect(positiveNumber("0", "Rent")).toBe("Rent must be greater than zero.");
		expect(positiveNumber("-5", "Rent")).toBe("Rent must be greater than zero.");
	});
	it("accepts positive numbers", () => {
		expect(positiveNumber("1500.50", "Rent")).toBeUndefined();
	});
});

describe("validEmail", () => {
	it("treats empty as valid (optional field)", () => {
		expect(validEmail("")).toBeUndefined();
	});
	it("rejects malformed addresses", () => {
		expect(validEmail("not-an-email")).toBeDefined();
		expect(validEmail("a@b")).toBeDefined();
	});
	it("accepts normal addresses", () => {
		expect(validEmail("a@b.co")).toBeUndefined();
	});
});

describe("isoDate / dateRange", () => {
	it("validates dates", () => {
		expect(isoDate("", "Start")).toBe("Start is required.");
		expect(isoDate("nonsense", "Start")).toBe("Start must be a valid date.");
		expect(isoDate("2026-07-01", "Start")).toBeUndefined();
	});
	it("requires end strictly after start", () => {
		expect(dateRange("2026-07-01", "2026-07-01")).toBeDefined();
		expect(dateRange("2026-07-01", "2026-06-30")).toBeDefined();
		expect(dateRange("2026-07-01", "2027-07-01")).toBeUndefined();
		expect(dateRange("", "2027-07-01")).toBeUndefined();
	});
});

describe("hasErrors / compactErrors", () => {
	it("detects and compacts", () => {
		expect(hasErrors({ a: undefined })).toBe(false);
		expect(hasErrors({ a: "bad" })).toBe(true);
		expect(compactErrors({ a: "bad", b: undefined })).toEqual({ a: "bad" });
	});
});
