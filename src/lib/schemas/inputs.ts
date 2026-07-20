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
	project_id: z.string().uuid().nullish(),
	is_new_build: z.boolean().optional(),
});

// Budget bounds are cross-field validated, so the schema is a refined object.
// `.partial()` is not available on a refined schema, so updateLead() builds its
// patch schema from this unrefined base and re-applies the same rule below.
const leadInputObject = z
	.object({
		full_name: trimmedName,
		phone: z.string().nullish(),
		email: optionalEmail,
		interested_in: z.string().nullish(),
		pref_listing_type: listingTypeSchema.nullish(),
		pref_nitelik: z.string().nullish(),
		pref_min_bedrooms: z.number().int().min(0).nullish(),
		pref_location: z.string().nullish(),
		pref_min_price: money.nullish(),
		pref_max_price: money.nullish(),
		pref_currency: z.string().length(3).optional(),
		status: leadStatusSchema.optional(),
		notes: z.string().nullish(),
		last_call_at: z.string().nullish(),
		assigned_to: z.string().uuid().nullish(),
	});

// Mirrors the leads_budget_range_check constraint in 0026. Either bound may be
// omitted (open-ended); only an inverted stated range is rejected.
const budgetRangeRule = (l: {
	pref_min_price?: number | null;
	pref_max_price?: number | null;
}) =>
	l.pref_min_price == null ||
	l.pref_max_price == null ||
	l.pref_max_price >= l.pref_min_price;

const budgetRangeError = {
	message: "maximum budget must not be below the minimum",
	path: ["pref_max_price"],
};

export const leadInputSchema = leadInputObject.refine(budgetRangeRule, budgetRangeError);

/** Patch schema for updateLead() — same budget rule, all fields optional. */
export const leadPatchSchema = leadInputObject.partial().refine(budgetRangeRule, budgetRangeError);

// Construction-company project. `drive_url` is rendered as an outbound link, so
// it is restricted to https — an unchecked value would let a stored
// `javascript:` URL run when an agent clicks it.
const httpsUrl = z
	.string()
	.trim()
	.refine((v) => {
		try {
			return new URL(v).protocol === "https:";
		} catch {
			return false;
		}
	}, "must be a valid https:// URL");

const projectInputObject = z.object({
	name: trimmedName,
	developer_name: z.string().nullish(),
	drive_url: z.union([httpsUrl, z.literal(""), z.null()]).optional(),
	city: z.string().nullish(),
	mahalle: z.string().nullish(),
	delivery_date: z.union([isoDate, z.literal(""), z.null()]).optional(),
	price_from: money.nullish(),
	price_currency: z.string().length(3).optional(),
	notes: z.string().nullish(),
});

export const projectInputSchema = projectInputObject;
/** Patch schema for updateProject() — every field optional. */
export const projectPatchSchema = projectInputObject.partial();

export const activityKindSchema = z.enum([
	"call", "whatsapp", "meeting", "viewing", "note", "status_change",
]);

const contactActivityObject = z.object({
	lead_id: z.string().uuid().nullish(),
	tenant_id: z.string().uuid().nullish(),
	kind: activityKindSchema,
	body: z.string().nullish(),
	property_id: z.string().uuid().nullish(),
	occurred_at: z.string().nullish(),
});

// Mirrors contact_activity_one_subject_check in 0027: an activity belongs to
// exactly one contact. Catching it here turns a raw Postgres constraint error
// into a readable message.
export const contactActivityInputSchema = contactActivityObject.refine(
	(a) => (a.lead_id == null) !== (a.tenant_id == null),
	{ message: "an activity must belong to exactly one lead or tenant", path: ["lead_id"] },
);

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
