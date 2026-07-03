import { describe, expect, it } from "vitest";
import { computeLeaseEndDate } from "./leases";

describe("computeLeaseEndDate", () => {
	it("returns null for open-ended terms", () => {
		expect(computeLeaseEndDate("2026-07-01", "undefined")).toBeNull();
	});
	it("adds one year for 1yr terms", () => {
		expect(computeLeaseEndDate("2026-07-01", "1yr")).toBe("2027-07-01");
	});
	it("adds two years for 2yr terms", () => {
		expect(computeLeaseEndDate("2026-07-01", "2yr")).toBe("2028-07-01");
	});
	it("handles leap-day starts", () => {
		expect(computeLeaseEndDate("2024-02-29", "1yr")).toBe("2025-03-01");
	});
});
