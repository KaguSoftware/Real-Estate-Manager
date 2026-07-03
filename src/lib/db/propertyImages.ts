// Property image uploads. Files live in the `property-images` Supabase
// Storage bucket under {user_id}/{property_id}/{uuid}.{ext}; metadata
// (path + ordering) lives in public.property_images. Storage RLS gates
// uploads by user-id prefix; table RLS gates row visibility.

import { createClient } from "@/src/lib/supabase/client";
import type { PropertyImage } from "./types";

const BUCKET = "property-images";

interface PropertyImageRow {
	id: string;
	owner_id: string;
	property_id: string;
	storage_path: string;
	position: number;
	created_at: string;
}

async function requireUser() {
	const supabase = createClient();
	const { data: { user }, error } = await supabase.auth.getUser();
	if (error || !user) throw new Error("Not authenticated");
	return { supabase, user };
}

function withUrl(row: PropertyImageRow, supabase: ReturnType<typeof createClient>): PropertyImage {
	const { data } = supabase.storage.from(BUCKET).getPublicUrl(row.storage_path);
	return { ...row, url: data.publicUrl };
}

export async function listPropertyImages(propertyId: string): Promise<PropertyImage[]> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("property_images")
		.select("*")
		.eq("property_id", propertyId)
		.order("position", { ascending: true });
	if (error) throw error;
	return ((data ?? []) as PropertyImageRow[]).map((r) => withUrl(r, supabase));
}

/** Cover (first-by-position) image URL per property, one query for a whole list. */
export async function listCoverImages(
	propertyIds: string[],
): Promise<Record<string, string>> {
	if (propertyIds.length === 0) return {};
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("property_images")
		.select("property_id, storage_path, position")
		.in("property_id", propertyIds)
		.order("position", { ascending: true });
	if (error) throw error;

	const covers: Record<string, string> = {};
	for (const row of (data ?? []) as Pick<PropertyImageRow, "property_id" | "storage_path" | "position">[]) {
		if (covers[row.property_id]) continue; // rows are position-ordered → first wins
		covers[row.property_id] = supabase.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl;
	}
	return covers;
}

export async function uploadPropertyImage(
	propertyId: string,
	file: File,
): Promise<PropertyImage> {
	const { supabase, user } = await requireUser();

	const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name);
	const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
	const id = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
	const path = `${user.id}/${propertyId}/${id}.${ext}`;

	const { error: upErr } = await supabase
		.storage.from(BUCKET)
		.upload(path, file, { contentType: file.type, upsert: false });
	if (upErr) throw upErr;

	// Append at the end of the current ordering. Race-free enough for one user.
	const { data: maxRow } = await supabase
		.from("property_images")
		.select("position")
		.eq("property_id", propertyId)
		.order("position", { ascending: false })
		.limit(1)
		.maybeSingle();
	const nextPosition = (maxRow?.position ?? -1) + 1;

	const { data, error } = await supabase
		.from("property_images")
		.insert({
			owner_id: user.id,
			property_id: propertyId,
			storage_path: path,
			position: nextPosition,
		})
		.select()
		.single();
	if (error) {
		// Best-effort cleanup of orphan storage object.
		await supabase.storage.from(BUCKET).remove([path]);
		throw error;
	}
	return withUrl(data as PropertyImageRow, supabase);
}

export async function deletePropertyImage(image: PropertyImage): Promise<void> {
	const { supabase } = await requireUser();
	// Storage first; if DB delete fails afterwards we get a stale row but no orphan file.
	await supabase.storage.from(BUCKET).remove([image.storage_path]);
	const { error } = await supabase.from("property_images").delete().eq("id", image.id);
	if (error) throw error;
}

export async function reorderPropertyImage(imageId: string, newPosition: number): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase
		.from("property_images")
		.update({ position: newPosition })
		.eq("id", imageId);
	if (error) throw error;
}
