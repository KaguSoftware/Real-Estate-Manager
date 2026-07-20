// Lead / client CRM CRUD. RLS on public.leads does authorization;
// each call just verifies a session exists and lets the database enforce ownership.

import type { Lead, LeadStatus, ListingType } from "./types";
import { orIlikeAnyColumn } from "./filterString";
import { leadInputSchema, leadPatchSchema, parseInput } from "@/src/lib/schemas/inputs";
import { requireTeamId } from "./teams";
import { requireUser } from "./requireUser";

export interface LeadFilter {
	status?: LeadStatus;
	q?: string;
}

export interface LeadInput {
	full_name: string;
	phone?: string | null;
	email?: string | null;
	interested_in?: string | null;
	pref_listing_type?: ListingType | null;
	pref_nitelik?: string | null;
	pref_min_bedrooms?: number | null;
	pref_location?: string | null;
	pref_min_price?: number | null;
	pref_max_price?: number | null;
	pref_currency?: string;
	status?: LeadStatus;
	notes?: string | null;
	last_call_at?: string | null;
	assigned_to?: string | null;
}


export async function listLeads(filter: LeadFilter = {}): Promise<Lead[]> {
	const { supabase } = await requireUser();

	let q = supabase.from("leads").select("*").order("updated_at", { ascending: false });
	if (filter.status) q = q.eq("status", filter.status);
	if (filter.q && filter.q.trim()) {
		q = q.or(orIlikeAnyColumn(["full_name", "phone", "interested_in"], filter.q.trim()));
	}

	const { data, error } = await q;
	if (error) throw error;
	return (data ?? []) as Lead[];
}

export async function getLead(id: string): Promise<Lead> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("leads").select("*").eq("id", id).single();
	if (error) throw error;
	return data as Lead;
}

export async function createLead(input: LeadInput): Promise<Lead> {
	const parsed = parseInput(leadInputSchema, input);
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("leads")
		.insert({ ...parsed, team_id: requireTeamId(), created_by: user.id })
		.select()
		.single();
	if (error) throw error;
	return data as Lead;
}

export async function updateLead(
	id: string,
	patch: Partial<LeadInput>,
): Promise<Lead> {
	const parsed = parseInput(leadPatchSchema, patch);
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("leads")
		.update(parsed)
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as Lead;
}

export async function deleteLead(id: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.from("leads").delete().eq("id", id);
	if (error) throw error;
}
