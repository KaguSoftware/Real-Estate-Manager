// Construction-company projects — the inventory that never reaches public
// portals. Each project is a lightweight record whose real content lives in the
// Google Drive folder the developer shares with the agency (catalogs, drone
// footage, price lists), so `drive_url` is the load-bearing field.
//
// Linked property rows are OPTIONAL: agents add a unit only when a specific one
// matters. `price_from` exists so a project with no unit rows can still be
// surfaced against a lead's budget.
//
// RLS on public.projects does authorization; each call just verifies a session
// exists and lets the database enforce team scope.

import { createClient } from "@/src/lib/supabase/client";
import type { Project } from "./types";
import { orIlikeAnyColumn } from "./filterString";
import { projectInputSchema, projectPatchSchema, parseInput } from "@/src/lib/schemas/inputs";
import { requireTeamId } from "./teams";

export interface ProjectFilter {
	q?: string;
	/** Construction company — the "category by building companies" grouping. */
	developer_name?: string;
}

export interface ProjectInput {
	name: string;
	developer_name?: string | null;
	drive_url?: string | null;
	city?: string | null;
	mahalle?: string | null;
	delivery_date?: string | null;
	price_from?: number | null;
	price_currency?: string;
	notes?: string | null;
}

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

export async function listProjects(filter: ProjectFilter = {}): Promise<Project[]> {
	const { supabase } = await requireUser();

	let q = supabase.from("projects").select("*").order("updated_at", { ascending: false });
	if (filter.developer_name) q = q.eq("developer_name", filter.developer_name);
	if (filter.q && filter.q.trim()) {
		q = q.or(orIlikeAnyColumn(["name", "developer_name", "city", "mahalle"], filter.q.trim()));
	}

	const { data, error } = await q;
	if (error) throw error;
	return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("projects").select("*").eq("id", id).single();
	if (error) throw error;
	return data as Project;
}

export async function createProject(input: ProjectInput): Promise<Project> {
	const parsed = parseInput(projectInputSchema, input);
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("projects")
		.insert({ ...normalizeBlanks(parsed), team_id: requireTeamId(), created_by: user.id })
		.select()
		.single();
	if (error) throw error;
	return data as Project;
}

export async function updateProject(
	id: string,
	patch: Partial<ProjectInput>,
): Promise<Project> {
	const parsed = parseInput(projectPatchSchema, patch);
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("projects")
		.update(normalizeBlanks(parsed))
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.from("projects").delete().eq("id", id);
	if (error) throw error;
}

/**
 * Forms submit cleared optional fields as "" — store NULL instead so
 * `delivery_date` (a DATE column) doesn't reject the empty string and
 * `drive_url` stays absent rather than becoming a falsy-but-present value.
 */
function normalizeBlanks<T extends Record<string, unknown>>(input: T): T {
	const out = { ...input };
	for (const key of ["drive_url", "delivery_date"] as const) {
		if (out[key] === "") (out as Record<string, unknown>)[key] = null;
	}
	return out;
}
