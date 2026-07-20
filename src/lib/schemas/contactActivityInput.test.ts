// The activity schema is the boundary that keeps a malformed interaction row
// out of the database. Its one-subject rule mirrors the
// contact_activity_one_subject_check constraint in 0027 — catching it here
// turns a raw Postgres error into a readable message.

import { describe, expect, it } from "vitest";
import { contactActivityInputSchema, parseInput } from "./inputs";

const LEAD = "11111111-1111-4111-8111-111111111111";
const TENANT = "22222222-2222-4222-8222-222222222222";
const PROPERTY = "33333333-3333-4333-8333-333333333333";

describe("contactActivityInputSchema", () => {
	it("accepts an activity attached to a lead", () => {
		const parsed = parseInput(contactActivityInputSchema, { lead_id: LEAD, kind: "call" });
		expect(parsed.lead_id).toBe(LEAD);
		expect(parsed.kind).toBe("call");
	});

	it("accepts an activity attached to a tenant", () => {
		expect(
			parseInput(contactActivityInputSchema, { tenant_id: TENANT, kind: "note" }).tenant_id,
		).toBe(TENANT);
	});

	it("rejects an activity with no subject", () => {
		expect(() => parseInput(contactActivityInputSchema, { kind: "call" })).toThrow();
		expect(() =>
			parseInput(contactActivityInputSchema, { lead_id: null, tenant_id: null, kind: "call" }),
		).toThrow();
	});

	it("rejects an activity attached to both a lead and a tenant", () => {
		expect(() =>
			parseInput(contactActivityInputSchema, { lead_id: LEAD, tenant_id: TENANT, kind: "call" }),
		).toThrow();
	});

	it("rejects an unknown kind", () => {
		expect(() => parseInput(contactActivityInputSchema, { lead_id: LEAD, kind: "email" })).toThrow();
		expect(() => parseInput(contactActivityInputSchema, { lead_id: LEAD, kind: "" })).toThrow();
	});

	it("accepts every kind the database allows", () => {
		for (const kind of ["call", "whatsapp", "meeting", "viewing", "note", "status_change"]) {
			expect(() => parseInput(contactActivityInputSchema, { lead_id: LEAD, kind })).not.toThrow();
		}
	});

	it("rejects a non-uuid subject or property", () => {
		expect(() => parseInput(contactActivityInputSchema, { lead_id: "not-a-uuid", kind: "call" })).toThrow();
		expect(() =>
			parseInput(contactActivityInputSchema, { lead_id: LEAD, kind: "viewing", property_id: "nope" }),
		).toThrow();
	});

	it("accepts an optional linked property and body", () => {
		const parsed = parseInput(contactActivityInputSchema, {
			lead_id: LEAD,
			kind: "viewing",
			property_id: PROPERTY,
			body: "Alsancak 3+1 gösterildi.",
		});
		expect(parsed.property_id).toBe(PROPERTY);
		expect(parsed.body).toBe("Alsancak 3+1 gösterildi.");
	});
});
