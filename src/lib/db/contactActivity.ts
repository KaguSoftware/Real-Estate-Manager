// Contact interaction history — calls, viewings, meetings and notes recorded
// against a lead or tenant.
//
// Replaces the previous approach of prepending "[tarih] Arandı." into the
// free-text notes column, which the lead/tenant forms overwrote wholesale on
// save. History here is structured, attributed to the agent who logged it, and
// cannot be destroyed by editing a textarea.
//
// RLS on public.contact_activity does authorization; each call just verifies a
// session exists and lets the database enforce team scope.

import { createClient } from "@/src/lib/supabase/client";
import type { ActivityKind, ContactActivity } from "./types";
import { contactActivityInputSchema, parseInput } from "@/src/lib/schemas/inputs";
import { requireTeamId } from "./teams";

/** An activity row plus the display name of whoever logged it. */
export interface ContactActivityWithAuthor extends ContactActivity {
	author_name: string | null;
}

export interface ContactActivityInput {
	lead_id?: string | null;
	tenant_id?: string | null;
	kind: ActivityKind;
	body?: string | null;
	property_id?: string | null;
	/** ISO timestamp; defaults to now when omitted (back-dating is allowed). */
	occurred_at?: string | null;
}

/** Kinds that count as "we reached the client", so `last_call_at` tracks them. */
const CONTACT_KINDS: ActivityKind[] = ["call", "whatsapp", "meeting"];

async function requireUser() {
	const supabase = createClient();
	// getSession() is local (no auth-server round-trip); RLS enforces authorization.
	const {
		data: { session },
		error,
	} = await supabase.auth.getSession();
	if (error || !session?.user) throw new Error("Not authenticated");
	return { supabase, user: session.user };
}

export async function listActivity(
	subject: { leadId: string } | { tenantId: string },
): Promise<ContactActivityWithAuthor[]> {
	const { supabase } = await requireUser();

	let q = supabase
		.from("contact_activity")
		// Teammate profiles are readable via profiles_select_teammates (0010),
		// so the author's name resolves without a second round-trip.
		.select("*, author:profiles!contact_activity_created_by_fkey(display_name, email)")
		.order("occurred_at", { ascending: false });

	q = "leadId" in subject
		? q.eq("lead_id", subject.leadId)
		: q.eq("tenant_id", subject.tenantId);

	const { data, error } = await q;
	if (error) throw error;

	return (data ?? []).map((row) => {
		const { author, ...rest } = row as ContactActivity & {
			author: { display_name: string | null; email: string } | { display_name: string | null; email: string }[] | null;
		};
		// PostgREST returns an object for a to-one join, but an array when it
		// can't prove cardinality — normalize both.
		const a = Array.isArray(author) ? author[0] : author;
		return {
			...rest,
			author_name: a?.display_name ?? a?.email ?? null,
		} as ContactActivityWithAuthor;
	});
}

export async function logActivity(input: ContactActivityInput): Promise<ContactActivity> {
	const parsed = parseInput(contactActivityInputSchema, input);
	const { supabase, user } = await requireUser();
	const teamId = requireTeamId();

	const occurredAt = parsed.occurred_at || new Date().toISOString();

	const { data, error } = await supabase
		.from("contact_activity")
		.insert({
			lead_id: parsed.lead_id ?? null,
			tenant_id: parsed.tenant_id ?? null,
			kind: parsed.kind,
			body: parsed.body ?? null,
			property_id: parsed.property_id ?? null,
			occurred_at: occurredAt,
			team_id: teamId,
			created_by: user.id,
		})
		.select()
		.single();
	if (error) throw error;

	// Keep the denormalised leads.last_call_at in step. The attention feed's
	// "gone quiet" list and the contacts table both read it, so letting the two
	// drift would silently break those.
	if (parsed.lead_id && CONTACT_KINDS.includes(parsed.kind)) {
		const { error: updErr } = await supabase
			.from("leads")
			.update({ last_call_at: occurredAt })
			.eq("id", parsed.lead_id)
			// Never move the marker backwards when back-dating an older call.
			.or(`last_call_at.is.null,last_call_at.lt.${occurredAt}`);
		// Non-fatal: the activity row is the source of truth; the marker is a cache.
		if (updErr) console.warn("last_call_at update failed", updErr);
	}

	return data as ContactActivity;
}

export async function deleteActivity(id: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.from("contact_activity").delete().eq("id", id);
	if (error) throw error;
}
