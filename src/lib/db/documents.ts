// Generated contract PDFs, stored in the private "documents" bucket
// (migration 0009) and linked from leases.document_pdf_path /
// sales.document_pdf_path. Reads use short-lived signed URLs because the
// bucket is private (contracts hold personal data).

import { createClient } from "@/src/lib/supabase/client";

const BUCKET = "documents";

async function requireUser() {
	const supabase = createClient();
	const { data: { session }, error } = await supabase.auth.getSession();
	if (error || !session?.user) throw new Error("Not authenticated");
	return { supabase, user: session.user };
}

/**
 * Upload a contract PDF and link it to its lease or sale row.
 * Path convention: {user_id}/{record_id}.pdf (upsert — regenerating a
 * contract replaces the stored copy).
 */
export async function saveDocumentPdf(
	record: { table: "leases" | "sales"; id: string },
	file: File,
): Promise<string> {
	const { supabase, user } = await requireUser();
	const path = `${user.id}/${record.id}.pdf`;

	const { error: upErr } = await supabase.storage
		.from(BUCKET)
		.upload(path, file, { upsert: true, contentType: "application/pdf" });
	if (upErr) throw upErr;

	const { error: linkErr } = await supabase
		.from(record.table)
		.update({ document_pdf_path: path })
		.eq("id", record.id);
	if (linkErr) throw linkErr;

	return path;
}

/** Short-lived signed URL for a stored contract PDF (private bucket). */
export async function getDocumentUrl(path: string): Promise<string> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(path, 60 * 10);
	if (error) throw error;
	return data.signedUrl;
}
