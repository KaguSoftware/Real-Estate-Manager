// Property CRUD. RLS on public.properties does authorization;
// each call just verifies a session exists and lets the database enforce ownership.

import { createClient } from "@/src/lib/supabase/client";
import type {
	Property,
	PropertyWithActiveLease,
	PropertyStatus,
	ListingType,
	DocKind,
	Tenant,
	Lease,
} from "./types";
import { getLeaseBalance } from "./payments";
import { orIlikeAnyColumn, orIlikeAnyValue } from "./filterString";
import { parseInput, propertyInputSchema } from "@/src/lib/schemas/inputs";
import { requireTeamId } from "./teams";

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
}

async function requireUser() {
	const supabase = createClient();
	// getSession() reads the locally-cached session (no auth-server round-trip),
	// so list/CRUD calls don't pay network latency just to confirm a session.
	// RLS still enforces authorization on every query.
	const {
		data: { session },
		error,
	} = await supabase.auth.getSession();
	if (error || !session?.user) throw new Error("Not authenticated");
	return { supabase, user: session.user };
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

	const { data: prop, error: pErr } = await supabase
		.from("properties").select("*").eq("id", id).single();
	if (pErr) throw pErr;
	const property = prop as Property;

	const { data: leaseRow, error: lErr } = await supabase
		.from("leases").select("*")
		.eq("property_id", id)
		.eq("status", "active")
		.maybeSingle();
	if (lErr) throw lErr;

	if (!leaseRow) {
		return { ...property, active_lease: null };
	}

	const lease = leaseRow as Lease;
	const { data: tenantRow, error: tErr } = await supabase
		.from("tenants").select("*").eq("id", lease.tenant_id).single();
	if (tErr) throw tErr;

	const balance = await getLeaseBalance(lease.id);
	return {
		...property,
		active_lease: { ...lease, tenant: tenantRow as Tenant, balance },
	};
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
