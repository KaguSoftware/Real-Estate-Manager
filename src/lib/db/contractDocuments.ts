// Editable contract documents (migration 0017): the block-editor JSON plus a
// frozen snapshot of the wizard data, linked 1:1 to a lease or sale. Drafts
// stay editable; finalize() locks them (DB-trigger enforced, not just UI).

import { requireTeamId } from "./teams";
import type { EditorDocJSON } from "@/src/lib/documents/blocks";
import type { RentalPDFData, SalesPDFData } from "@/src/lib/pdf/types";
import { requireUser } from "./requireUser";

export type ContractDocKind = "rental" | "sales";
export type ContractDocStatus = "draft" | "finalized";

export interface ContractDocument {
	id: string;
	team_id: string;
	created_by: string | null;
	kind: ContractDocKind;
	lease_id: string | null;
	sale_id: string | null;
	title: string;
	subtitle: string | null;
	content: EditorDocJSON;
	source_data: RentalPDFData | SalesPDFData;
	status: ContractDocStatus;
	finalized_at: string | null;
	pdf_path: string | null;
	created_at: string;
	updated_at: string;
}

export interface ContractDocumentInput {
	kind: ContractDocKind;
	lease_id?: string | null;
	sale_id?: string | null;
	title: string;
	subtitle?: string | null;
	content: EditorDocJSON;
	source_data: RentalPDFData | SalesPDFData;
}

/**
 * Create the editable document for a freshly created lease/sale. Upsert-like:
 * if a row already exists for the record (wizard retry after a failed
 * download/upload step), it is updated instead of violating the unique index.
 */
export async function createContractDocument(input: ContractDocumentInput): Promise<ContractDocument> {
	const { supabase, user } = await requireUser();
	const recordCol = input.kind === "rental" ? "lease_id" : "sale_id";
	const recordId = input.kind === "rental" ? input.lease_id : input.sale_id;
	if (!recordId) throw new Error("contract document requires its lease/sale id");

	const existing = await getContractDocumentByRecord(input.kind, recordId);
	if (existing) {
		const { data, error } = await supabase
			.from("contract_documents")
			.update({
				title: input.title,
				subtitle: input.subtitle ?? null,
				content: input.content,
				source_data: input.source_data,
			})
			.eq("id", existing.id)
			.select()
			.single();
		if (error) throw error;
		return data as ContractDocument;
	}

	const { data, error } = await supabase
		.from("contract_documents")
		.insert({
			team_id: requireTeamId(),
			created_by: user.id,
			kind: input.kind,
			[recordCol]: recordId,
			title: input.title,
			subtitle: input.subtitle ?? null,
			content: input.content,
			source_data: input.source_data,
		})
		.select()
		.single();
	if (error) throw error;
	return data as ContractDocument;
}

export interface ContractDocumentFilter {
	q?: string;
	kind?: ContractDocKind;
	status?: ContractDocStatus;
}

/** Team's documents for the /documents index — column-light (no content/
 *  source_data blobs; the editor page fetches the full row by id). */
export type ContractDocumentListItem = Pick<
	ContractDocument,
	"id" | "kind" | "title" | "subtitle" | "status" | "finalized_at" | "pdf_path" | "created_at" | "updated_at"
>;

export async function listContractDocuments(
	filter: ContractDocumentFilter = {},
): Promise<ContractDocumentListItem[]> {
	const { supabase } = await requireUser();
	let query = supabase
		.from("contract_documents")
		.select("id, kind, title, subtitle, status, finalized_at, pdf_path, created_at, updated_at")
		.order("updated_at", { ascending: false });
	if (filter.kind) query = query.eq("kind", filter.kind);
	if (filter.status) query = query.eq("status", filter.status);
	if (filter.q?.trim()) {
		const q = filter.q.trim().replace(/[%_,]/g, " ");
		query = query.or(`title.ilike.%${q}%,subtitle.ilike.%${q}%`);
	}
	const { data, error } = await query;
	if (error) throw error;
	return (data ?? []) as ContractDocumentListItem[];
}

export async function getContractDocument(id: string): Promise<ContractDocument | null> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("contract_documents")
		.select("*")
		.eq("id", id)
		.maybeSingle();
	if (error) throw error;
	return (data as ContractDocument) ?? null;
}

export async function getContractDocumentByRecord(
	kind: ContractDocKind,
	recordId: string,
): Promise<ContractDocument | null> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("contract_documents")
		.select("*")
		.eq(kind === "rental" ? "lease_id" : "sale_id", recordId)
		.maybeSingle();
	if (error) throw error;
	return (data as ContractDocument) ?? null;
}

export async function updateContractDocument(
	id: string,
	patch: Partial<Pick<ContractDocument, "title" | "subtitle" | "content">>,
): Promise<ContractDocument> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("contract_documents")
		.update(patch)
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as ContractDocument;
}

/** One-way lock (DB trigger rejects later content edits). */
export async function finalizeContractDocument(id: string): Promise<ContractDocument> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("contract_documents")
		.update({ status: "finalized", finalized_at: new Date().toISOString() })
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as ContractDocument;
}

/** Record where the generated PDF was archived (documents bucket path). */
export async function setContractDocumentPdfPath(id: string, path: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase
		.from("contract_documents")
		.update({ pdf_path: path })
		.eq("id", id);
	if (error) throw error;
}
