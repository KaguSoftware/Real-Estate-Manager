// Zod schemas for the db-layer *Input shapes — one source of truth validated
// at the client/database boundary (create/update calls parse through these),
// independent of whatever per-field UX validation each form does. The tiny
// helpers in lib/validation.ts remain for inline form error messages; these
// schemas are the safety net that guarantees nothing malformed reaches
// PostgREST regardless of which form (or future code path) sends it.

import { z } from "zod";

const isoDate = z
	.string()
	.refine((v) => !Number.isNaN(Date.parse(v)), "must be a valid date");

const trimmedName = z.string().trim().min(1, "is required");
const optionalEmail = z.union([z.string().trim().email(), z.literal(""), z.null()]).optional();
const money = z.number().finite().nonnegative();

export const listingTypeSchema = z.enum(["for_rent", "for_sale"]);
export const propertyStatusSchema = z.enum(["vacant", "occupied", "sold"]);
export const leadStatusSchema = z.enum([
	"new", "called_rejected", "follow_up", "interested", "closed",
]);
export const leaseTermSchema = z.enum(["1yr", "2yr", "undefined"]);
export const utilityResponsibilitySchema = z.enum(["tenant", "landlord", "shared"]);

export const propertyInputSchema = z.object({
	homeowner_name: trimmedName,
	address_line: trimmedName,
	city: z.string().nullish(),
	size_sqm: z.number().positive().nullish(),
	bedrooms: z.number().int().min(0).nullish(),
	bathrooms: z.number().int().min(0).nullish(),
	listing_type: listingTypeSchema,
	status: propertyStatusSchema.optional(),
	list_price: money.nullish(),
	currency: z.string().length(3).optional(),
	notes: z.string().nullish(),
	furnished: z.boolean().nullish(),
	nitelik: z.string().nullish(),
	ada_no: z.string().nullish(),
	parsel_no: z.string().nullish(),
	mahalle: z.string().nullish(),
	mevkii: z.string().nullish(),
	latitude: z.number().min(-90).max(90).nullish(),
	longitude: z.number().min(-180).max(180).nullish(),
	assigned_to: z.string().uuid().nullish(),
});

export const leadInputSchema = z.object({
	full_name: trimmedName,
	phone: z.string().nullish(),
	email: optionalEmail,
	interested_in: z.string().nullish(),
	pref_listing_type: listingTypeSchema.nullish(),
	pref_nitelik: z.string().nullish(),
	pref_min_bedrooms: z.number().int().min(0).nullish(),
	pref_location: z.string().nullish(),
	status: leadStatusSchema.optional(),
	notes: z.string().nullish(),
	last_call_at: z.string().nullish(),
	assigned_to: z.string().uuid().nullish(),
});

export const tenantInputSchema = z.object({
	full_name: trimmedName,
	email: optionalEmail,
	phone: z.string().nullish(),
	national_id: z.string().nullish(),
	notes: z.string().nullish(),
});

export const paymentInputSchema = z
	.object({
		lease_id: z.string().uuid(),
		period_start: isoDate,
		period_end: isoDate,
		amount_due: z.number().positive(),
		amount_paid: money.optional(),
		paid_at: z.string().nullish(),
		method: z.string().nullish(),
		notes: z.string().nullish(),
	})
	.refine((p) => Date.parse(p.period_end) >= Date.parse(p.period_start), {
		message: "period end must not be before period start",
		path: ["period_end"],
	});

export const leaseInputSchema = z.object({
	property_id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	term: leaseTermSchema,
	start_date: isoDate,
	end_date: isoDate.nullish(),
	monthly_rent: z.number().positive(),
	deposit: money.optional(),
	currency: z.string().length(3).optional(),
	document_pdf_path: z.string().nullish(),
	guarantor_id: z.string().uuid().nullish(),
	payment_day: z.number().int().min(1).max(31).nullish(),
	payment_method: z.string().nullish(),
	bank_account: z.string().nullish(),
	util_electricity: utilityResponsibilitySchema.optional(),
	util_water: utilityResponsibilitySchema.optional(),
	util_gas: utilityResponsibilitySchema.optional(),
	util_internet: utilityResponsibilitySchema.optional(),
	util_aidat: utilityResponsibilitySchema.optional(),
	subletting_allowed: z.boolean().optional(),
	rent_increase_note: z.string().nullish(),
	inventory: z.array(z.object({ name: z.string(), note: z.string().optional() }).passthrough()).optional(),
	condition_notes: z.string().nullish(),
	special_conditions: z.string().nullish(),
});

/**
 * Parse `input` with `schema`, throwing an Error whose message lists the
 * offending fields in plain language (surfaced to users via humanizeError).
 */
export function parseInput<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
	const result = schema.safeParse(input);
	if (result.success) return result.data;
	const details = result.error.issues
		.map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
		.join("; ");
	throw new Error(`Invalid input — ${details}`);
}
