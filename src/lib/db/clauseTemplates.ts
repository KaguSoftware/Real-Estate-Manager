// Per-team clause templates (migration 0017). One row per (team, kind) with
// the whole clause set as a JSONB string array; an absent row means the
// built-in defaults (src/lib/documents/clauses.ts) apply. Writes are
// owner-only via RLS, mirroring branding.

import { createClient } from "@/src/lib/supabase/client";
import { requireTeamId } from "./teams";
import type { TemplateKind } from "@/src/lib/documents/placeholders";

async function requireUser() {
	const supabase = createClient();
	const { data: { user }, error } = await supabase.auth.getUser();
	if (error || !user) throw new Error("Not authenticated");
	return { supabase, user };
}

/** The team's saved clause set for a document kind, or null (use defaults). */
export async function getClauseTemplate(kind: TemplateKind): Promise<string[] | null> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("clause_templates")
		.select("clauses")
		.eq("team_id", requireTeamId())
		.eq("kind", kind)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	const clauses = data.clauses as unknown;
	return Array.isArray(clauses) ? clauses.map(String) : null;
}

/** Save (insert or replace) the team's clause set for a kind. Owner-only. */
export async function upsertClauseTemplate(kind: TemplateKind, clauses: string[]): Promise<void> {
	const cleaned = clauses.map((c) => c.trim()).filter(Boolean);
	if (cleaned.length === 0) throw new Error("En az bir madde gerekli");
	const { supabase } = await requireUser();
	const { error } = await supabase
		.from("clause_templates")
		.upsert(
			{ team_id: requireTeamId(), kind, clauses: cleaned },
			{ onConflict: "team_id,kind" },
		);
	if (error) throw error;
}

/** Remove the team's override so the built-in defaults apply again. Owner-only. */
export async function deleteClauseTemplate(kind: TemplateKind): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase
		.from("clause_templates")
		.delete()
		.eq("team_id", requireTeamId())
		.eq("kind", kind);
	if (error) throw error;
}
