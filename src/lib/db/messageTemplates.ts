// Per-team WhatsApp message templates (migration 0028). One row per
// (team, kind); an absent row means the built-in default in
// src/lib/whatsappMessage.ts applies. Writes are owner-only via RLS,
// mirroring clause templates and branding.

import { requireTeamId } from "./teams";
import { requireUser } from "./requireUser";

export type MessageTemplateKind = "whatsapp_property";


/** The team's saved template, or null when the built-in default applies. */
export async function getMessageTemplate(
	kind: MessageTemplateKind = "whatsapp_property",
): Promise<string | null> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("message_templates")
		.select("body")
		.eq("team_id", requireTeamId())
		.eq("kind", kind)
		.maybeSingle();
	if (error) throw error;
	return data?.body ?? null;
}

/** Save (insert or replace) the team's template. Owner-only. */
export async function upsertMessageTemplate(
	body: string,
	kind: MessageTemplateKind = "whatsapp_property",
): Promise<void> {
	const cleaned = body.trim();
	// Matches the DB's not-blank constraint; caught here for a readable message.
	if (!cleaned) throw new Error("Şablon boş olamaz");
	const { supabase } = await requireUser();
	const { error } = await supabase
		.from("message_templates")
		.upsert({ team_id: requireTeamId(), kind, body: cleaned }, { onConflict: "team_id,kind" });
	if (error) throw error;
}

/** Remove the override so the built-in default applies again. Owner-only. */
export async function deleteMessageTemplate(
	kind: MessageTemplateKind = "whatsapp_property",
): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase
		.from("message_templates")
		.delete()
		.eq("team_id", requireTeamId())
		.eq("kind", kind);
	if (error) throw error;
}
