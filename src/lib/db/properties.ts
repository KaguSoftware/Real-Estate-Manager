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

export interface PropertyFilter {
	listing_type?: ListingType;
	status?: PropertyStatus;
	q?: string;
	/** Property type / nitelik notation, e.g. "3+1". Substring match. */
	nitelik?: string;
	/** Minimum bedroom count. */
	min_bedrooms?: number;
	/** Free-text location — matches city, mahalle, or mevkii. */
	location?: string;
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
	// Turkish tapu (title-deed) fields — optional.
	nitelik?: string | null;
	ada_no?: string | null;
	parsel_no?: string | null;
	mahalle?: string | null;
	mevkii?: string | null;
	latitude?: number | null;
	longitude?: number | null;
}

async function requireUser() {
	const supabase = createClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	if (error || !user) throw new Error("Not authenticated");
	return { supabase, user };
}

export async function listProperties(filter: PropertyFilter = {}): Promise<Property[]> {
	const { supabase } = await requireUser();

	let q = supabase.from("properties").select("*").order("updated_at", { ascending: false });
	if (filter.listing_type) q = q.eq("listing_type", filter.listing_type);
	if (filter.status)       q = q.eq("status", filter.status);
	if (filter.q && filter.q.trim()) {
		const needle = `%${filter.q.trim()}%`;
		q = q.or(`homeowner_name.ilike.${needle},address_line.ilike.${needle},city.ilike.${needle}`);
	}
	if (filter.nitelik && filter.nitelik.trim()) {
		q = q.ilike("nitelik", `%${filter.nitelik.trim()}%`);
	}
	if (filter.min_bedrooms != null) {
		q = q.gte("bedrooms", filter.min_bedrooms);
	}
	if (filter.location && filter.location.trim()) {
		const loc = `%${filter.location.trim()}%`;
		// Multiple .or() groups are AND-combined by PostgREST, so this matches
		// the location term across city/mahalle/mevkii independently of `q`.
		q = q.or(`city.ilike.${loc},mahalle.ilike.${loc},mevkii.ilike.${loc}`);
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
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("properties")
		.insert({ ...input, owner_id: user.id })
		.select()
		.single();
	if (error) throw error;
	return data as Property;
}

export async function updateProperty(
	id: string,
	patch: Partial<PropertyInput>,
): Promise<Property> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("properties")
		.update(patch)
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
			.eq("listing_type", "for_rent").eq("status", "vacant")
			.order("updated_at", { ascending: false });
		if (error) throw error;
		return (data ?? []) as Property[];
	}

	if (kind === "sales") {
		const { data, error } = await supabase.from("properties").select("*")
			.eq("listing_type", "for_sale").neq("status", "sold")
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
