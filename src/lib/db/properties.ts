// Property CRUD. RLS on public.properties does authorization;
// each call just verifies a session exists and lets the database enforce ownership.

import type {
	Property,
	PropertyWithActiveLease,
	PropertyStatus,
	ListingType,
	DocKind,
	Tenant,
	Lease,
} from "./types";
import { orIlikeAnyColumn, orIlikeAnyValue } from "./filterString";
import { parseInput, propertyInputSchema } from "@/src/lib/schemas/inputs";
import { requireTeamId } from "./teams";
import { requireUser } from "./requireUser";

export interface PropertyFilter {
	listing_type?: ListingType;
	status?: PropertyStatus;
	q?: string;
	/** Property types / nitelik notation, e.g. ["3+1", "2+1"]. Substring match, OR-combined. */
	nitelik?: string[];
	/** Furnished flag — true = furnished only, false = unfurnished only, undefined = any. */
	furnished?: boolean;
	/** Locations — each matches city, mahalle, or mevkii. OR-combined across all values. */
	location?: string[];
	/** Budget floor. Properties with no list_price are excluded when either bound is set. */
	min_price?: number;
	/** Budget ceiling. */
	max_price?: number;
	/** Restricts a price range to one currency — there is no FX conversion, so a
	 *  range is only meaningful against prices quoted in the same currency. */
	currency?: string;
	/** New-build only (true) / second-hand only (false) / any (undefined). */
	is_new_build?: boolean;
	/** Units belonging to a specific construction project. */
	project_id?: string;
}

export interface PropertyInput {
	homeowner_name: string;
	address_line: string;
	city?: string | null;
	size_sqm?: number | null;
	bedrooms?: number | null;
	bathrooms?: number | null;
	listing_type: ListingType;
	status?: PropertyStatus;
	list_price?: number | null;
	currency?: string;
	notes?: string | null;
	furnished?: boolean | null;
	// Turkish tapu (title-deed) fields — optional.
	nitelik?: string | null;
	ada_no?: string | null;
	parsel_no?: string | null;
	mahalle?: string | null;
	mevkii?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	assigned_to?: string | null;
	project_id?: string | null;
	is_new_build?: boolean;
}


export async function listProperties(filter: PropertyFilter = {}): Promise<Property[]> {
	const { supabase } = await requireUser();

	let q = supabase.from("properties").select("*").order("updated_at", { ascending: false });
	if (filter.listing_type) q = q.eq("listing_type", filter.listing_type);
	if (filter.status)       q = q.eq("status", filter.status);
	if (filter.q && filter.q.trim()) {
		q = q.or(orIlikeAnyColumn(["homeowner_name", "address_line", "city"], filter.q.trim()));
	}
	const niteliks = (filter.nitelik ?? []).map((n) => n.trim()).filter(Boolean);
	if (niteliks.length > 0) {
		// Any of the selected types (OR), each a case-insensitive substring match.
		q = q.or(orIlikeAnyValue(["nitelik"], niteliks));
	}
	if (filter.furnished != null) {
		q = q.eq("furnished", filter.furnished);
	}
	if (filter.min_price != null) q = q.gte("list_price", filter.min_price);
	if (filter.max_price != null) q = q.lte("list_price", filter.max_price);
	// A price range means nothing across currencies (no FX conversion), so scope
	// it explicitly whenever one is given.
	if (filter.currency) q = q.eq("currency", filter.currency);
	if (filter.is_new_build != null) q = q.eq("is_new_build", filter.is_new_build);
	if (filter.project_id) q = q.eq("project_id", filter.project_id);

	const locations = (filter.location ?? []).map((l) => l.trim()).filter(Boolean);
	if (locations.length > 0) {
		// Each location may match city / mahalle / mevkii; all values are OR-combined.
		// Multiple .or() groups are AND-combined by PostgREST, so this is independent of `q`.
		q = q.or(orIlikeAnyValue(["city", "mahalle", "mevkii"], locations));
	}

	const { data, error } = await q;
	if (error) throw error;
	return (data ?? []) as Property[];
}

export async function getProperty(id: string): Promise<PropertyWithActiveLease> {
	const { supabase } = await requireUser();

	// ONE round-trip, not four. This used to walk property -> active lease ->
	// tenant -> payment rows sequentially, each awaiting the last: measured at
	// ~1322ms against production versus ~328ms for the embedded query below, on
	// the app's most-opened detail page. Every await here is a full network
	// round-trip (~330ms), so the only number that matters is how many of them
	// happen in series.
	//
	// `tenants!leases_tenant_id_fkey` is required, not decoration: leases
	// references tenants TWICE (tenant_id and guarantor_id), so an unqualified
	// `tenants(*)` is ambiguous and PostgREST rejects it with PGRST201. This
	// names the tenant relationship specifically — the guarantor is a different
	// person and must not be embedded here.
	const { data, error } = await supabase
		.from("properties")
		.select(
			"*,leases(*,tenants!leases_tenant_id_fkey(*),payments(amount_due,amount_paid))",
		)
		.eq("id", id)
		.single();
	if (error) throw error;

	const row = data as Property & { leases?: LeaseWithEmbeds[] };
	const { leases, ...property } = row;

	// The embed returns every lease for the property; the page wants the active
	// one. Filtering here rather than in the query keeps it a single round-trip
	// (a nested filter would need a second call to know there was no match).
	const lease = (leases ?? []).find((l) => l.status === "active");
	if (!lease) return { ...(property as Property), active_lease: null };

	const { tenants, payments, ...leaseFields } = lease;
	// Same reduction getLeaseBalance() does, over rows we already have.
	const rows = payments ?? [];
	const totalDue = rows.reduce((s, r) => s + Number(r.amount_due ?? 0), 0);
	const totalPaid = rows.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0);

	return {
		...(property as Property),
		active_lease: {
			...(leaseFields as Lease),
			tenant: tenants as Tenant,
			balance: { totalDue, totalPaid, balance: totalDue - totalPaid },
		},
	};
}

/** The shape the embedded select above returns for each lease row. */
type LeaseWithEmbeds = Lease & {
	tenants: Tenant;
	payments: { amount_due: number; amount_paid: number }[] | null;
};

// ── Detail prefetch ──────────────────────────────────────────────────────────
// Hovering a row in the property table starts its detail query immediately, so
// the data is usually in hand by the time the click lands. Results are held in
// a plain module Map (not the SWR cache) because this is a short-lived warm-up,
// not a cache with its own invalidation story: takeWarmProperty() consumes the
// entry so a stale copy can never be served twice.

const warmProperties = new Map<string, Promise<PropertyWithActiveLease>>();

/** Start (and remember) the detail fetch for `id`. Safe to call repeatedly. */
export function warmProperty(id: string): Promise<PropertyWithActiveLease> {
	const existing = warmProperties.get(id);
	if (existing) return existing;
	const promise = getProperty(id);
	warmProperties.set(id, promise);
	// A rejected warm-up must not sit in the map poisoning the real navigation.
	promise.catch(() => warmProperties.delete(id));
	return promise;
}

/** Take the in-flight/settled warm-up for `id`, if one exists. Consumes it. */
export function takeWarmProperty(id: string): Promise<PropertyWithActiveLease> | null {
	const hit = warmProperties.get(id);
	if (hit) warmProperties.delete(id);
	return hit ?? null;
}

export async function createProperty(input: PropertyInput): Promise<Property> {
	const parsed = parseInput(propertyInputSchema, input);
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("properties")
		.insert({ ...parsed, team_id: requireTeamId(), created_by: user.id })
		.select()
		.single();
	if (error) throw error;
	return data as Property;
}

export async function updateProperty(
	id: string,
	patch: Partial<PropertyInput>,
): Promise<Property> {
	const parsed = parseInput(propertyInputSchema.partial(), patch);
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("properties")
		.update(parsed)
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as Property;
}

export async function deleteProperty(id: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.from("properties").delete().eq("id", id);
	if (error) throw error;
}

/**
 * Delete many properties in ONE round-trip.
 *
 * The bulk-delete UI used to await deleteProperty() per row inside a loop, so
 * clearing 20 selected rows meant 20 sequential ~330ms round-trips — about six
 * seconds of spinner for a single click. RLS still filters the `in` list, so a
 * row the user may not delete is simply not deleted (same as the per-row path).
 */
export async function deleteProperties(ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const { supabase } = await requireUser();
	const { error } = await supabase.from("properties").delete().in("id", ids);
	if (error) throw error;
}

/** Which properties the wizard should offer for a given document kind. */
export async function listEligiblePropertiesForDocType(
	kind: DocKind,
): Promise<Property[]> {
	const { supabase } = await requireUser();

	if (kind === "rental") {
		const { data, error } = await supabase.from("properties").select("*")
			.eq("listing_type", "for_rent").eq("status", "vacant" satisfies PropertyStatus)
			.order("updated_at", { ascending: false });
		if (error) throw error;
		return (data ?? []) as Property[];
	}

	if (kind === "sales") {
		const { data, error } = await supabase.from("properties").select("*")
			.eq("listing_type", "for_sale").neq("status", "sold" satisfies PropertyStatus)
			.order("updated_at", { ascending: false });
		if (error) throw error;
		return (data ?? []) as Property[];
	}

	// kind === 'receipt' — properties with an active lease
	const { data: leases, error: lErr } = await supabase
		.from("leases").select("property_id").eq("status", "active");
	if (lErr) throw lErr;
	const propIds = [...new Set((leases ?? []).map((l) => (l as { property_id: string }).property_id))];
	if (propIds.length === 0) return [];

	const { data, error } = await supabase.from("properties").select("*")
		.in("id", propIds)
		.order("updated_at", { ascending: false });
	if (error) throw error;
	return (data ?? []) as Property[];
}
