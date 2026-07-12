"use client";

/**
 * DocumentEditorPage — re-edit an existing contract document (/documents/[id]).
 * Drafts are fully editable and can regenerate/replace the archived PDF;
 * "Sonlandır" locks the document one-way (DB-trigger enforced server-side).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Download, Lock, Save } from "lucide-react";
import { useAppStore } from "@/src/store";
import { humanizeError } from "@/src/lib/errors";
import {
	finalizeContractDocument,
	getContractDocument,
	setContractDocumentPdfPath,
	updateContractDocument,
	type ContractDocument,
} from "@/src/lib/db/contractDocuments";
import { saveDocumentPdf } from "@/src/lib/db/documents";
import {
	downloadPdfFile,
	generateEditorPdfFile,
	getPdfBrandingFromStore,
	EditorPDFDocument,
	BRAND_PALETTES,
	type PdfBranding,
} from "@/src/lib/pdf";
import { buildInitialDoc } from "@/src/lib/documents/buildInitialDoc";
import type { EditorDocJSON } from "@/src/lib/documents/blocks";
import type { ContractEditorHandle } from "./editor/ContractEditor";
import {
	Alert, Badge, Button, ConfirmDialog, FormField, Input, Spinner, cn, toast,
} from "@/src/components/ui";

const PDFBlobProvider = dynamic(
	() => import("@react-pdf/renderer").then((m) => m.BlobProvider),
	{ ssr: false, loading: () => <div className="text-sm text-base-content/50 p-6">Önizleme yükleniyor…</div> },
);

const ContractEditor = dynamic(
	() => import("./editor/ContractEditor").then((m) => m.ContractEditor),
	{ ssr: false, loading: () => <div className="text-sm text-base-content/50 p-6 text-center">Düzenleyici yükleniyor…</div> },
);

function docFilename(doc: ContractDocument): string {
	const base = doc.kind === "rental" ? "kira" : "satis";
	const title = doc.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60);
	return `${base}-${title || "sozlesme"}.pdf`;
}

export function DocumentEditorPage({ documentId }: { documentId: string }) {
	const router = useRouter();
	const team = useAppStore((s) => s.team);

	const [doc, setDoc] = useState<ContractDocument | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [subtitle, setSubtitle] = useState("");
	const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
	const [previewJson, setPreviewJson] = useState<EditorDocJSON | null>(null);
	// Latest editor content across mode toggles. The editor unmounts in PDF
	// mode; remounting from doc.content (last SAVED state) would silently
	// discard everything typed since the last Kaydet.
	const [liveContent, setLiveContent] = useState<EditorDocJSON | null>(null);
	const [branding, setBranding] = useState<PdfBranding | undefined>(undefined);
	const [ready, setReady] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const [dirty, setDirty] = useState(false);
	const [confirming, setConfirming] = useState<"finalize" | "reset" | null>(null);
	const editorApi = useRef<ContractEditorHandle | null>(null);

	// Load the document + fonts + branding together so the editor and the PDF
	// preview both start from a fully resolved state.
	useEffect(() => {
		let cancelled = false;
		Promise.all([
			getContractDocument(documentId),
			import("@/src/lib/pdf/styles").then((m) => m.loadPdfFonts()),
			getPdfBrandingFromStore(),
		])
			.then(([d, , b]) => {
				if (cancelled) return;
				if (!d) {
					setLoadError("Belge bulunamadı veya erişim yetkiniz yok.");
					return;
				}
				setDoc(d);
				setTitle(d.title);
				setSubtitle(d.subtitle ?? "");
				setBranding(b);
				setReady(true);
			})
			.catch((e) => { if (!cancelled) setLoadError(humanizeError(e)); });
		return () => { cancelled = true; };
	}, [documentId]);

	const editable = !!doc && doc.status === "draft" && (team?.is_writable ?? true);

	function currentJson(): EditorDocJSON | null {
		return (viewMode === "edit" ? editorApi.current?.getJSON() : null)
			?? liveContent ?? previewJson ?? doc?.content ?? null;
	}

	function switchMode(mode: "edit" | "preview") {
		if (mode === viewMode) return;
		if (mode === "preview") {
			const json = currentJson();
			if (!json) return;
			setLiveContent(json);
			setPreviewJson(json);
		}
		setViewMode(mode);
	}

	async function persist(): Promise<ContractDocument | null> {
		if (!doc) return null;
		const content = currentJson();
		if (!content) return doc;
		const updated = await updateContractDocument(doc.id, {
			title: title.trim() || doc.title,
			subtitle: subtitle.trim() || null,
			content,
		});
		setDoc(updated);
		setDirty(false);
		return updated;
	}

	async function onSave() {
		setBusy("save");
		try {
			await persist();
			toast.success("Belge kaydedildi.");
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setBusy(null);
		}
	}

	/** Regenerate the PDF from the current content, download it and replace
	 *  the archived copy ({team_id}/{record_id}.pdf — upsert). */
	async function regeneratePdf(source: ContractDocument) {
		const file = await generateEditorPdfFile(
			{
				kind: source.kind,
				title: source.title,
				subtitle: source.subtitle,
				doc: source.content,
				sourceData: source.source_data,
				branding: branding ?? (await getPdfBrandingFromStore()),
			},
			docFilename(source),
		);
		await downloadPdfFile(file);
		const record = source.kind === "rental"
			? { table: "leases" as const, id: source.lease_id! }
			: { table: "sales" as const, id: source.sale_id! };
		try {
			const path = await saveDocumentPdf(record, file);
			await setContractDocumentPdfPath(source.id, path);
		} catch {
			toast.error("PDF indirildi ancak çevrimiçi kopya güncellenemedi.");
		}
	}

	async function onDownload() {
		if (!doc) return;
		setBusy("pdf");
		try {
			const saved = editable ? await persist() : doc;
			await regeneratePdf(saved ?? doc);
			toast.success(editable ? "PDF indirildi ve arşiv güncellendi." : "PDF indirildi.");
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setBusy(null);
		}
	}

	async function onFinalizeConfirmed() {
		setConfirming(null);
		if (!doc) return;
		setBusy("finalize");
		try {
			const saved = await persist();
			const finalized = await finalizeContractDocument((saved ?? doc).id);
			await regeneratePdf({ ...finalized });
			setDoc(finalized);
			setViewMode("edit");
			toast.success("Belge sonlandırıldı — artık düzenlenemez.");
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setBusy(null);
		}
	}

	function onResetConfirmed() {
		setConfirming(null);
		if (!doc) return;
		const built = buildInitialDoc(
			doc.kind,
			doc.source_data,
			branding?.teamName ?? "Kagu Real Estate",
		);
		setLiveContent(built);
		editorApi.current?.setContent(built);
		setDirty(true);
		toast.success("Belge şablondan yeniden oluşturuldu.");
	}

	if (loadError) {
		return (
			<div className="space-y-4">
				<Alert tone="error">{loadError}</Alert>
				<Button variant="ghost" onClick={() => router.back()}>
					<ArrowLeft className="w-4 h-4" /> Geri
				</Button>
			</div>
		);
	}

	if (!doc || !ready) {
		return <div className="h-[50vh] flex items-center justify-center"><Spinner /></div>;
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div className="flex items-center gap-3 min-w-0">
					<Button variant="ghost" size="sm" onClick={() => router.back()} aria-label="Geri">
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<div className="min-w-0">
						<h2 className="font-display text-lg font-semibold text-base-content truncate">{doc.title}</h2>
						<p className="text-sm text-base-content/60">
							{doc.kind === "rental" ? "Kira sözleşmesi" : "Satış sözleşmesi"}
						</p>
					</div>
					{doc.status === "finalized" && (
						<Badge tone="slate">
							<Lock className="w-3 h-3" /> Sonlandırıldı
						</Badge>
					)}
				</div>

				<div className="flex gap-1 rounded-xl bg-base-200 p-1" role="tablist" aria-label="Görünüm">
					{(["edit", "preview"] as const).map((m) => (
						<button
							key={m}
							type="button"
							role="tab"
							aria-selected={viewMode === m}
							onClick={() => switchMode(m)}
							className={cn(
								"px-3 h-9 rounded-lg text-sm font-medium transition-colors",
								viewMode === m
									? "bg-base-100 text-base-content shadow-sm"
									: "text-base-content/60 hover:text-base-content",
							)}
						>
							{m === "edit" ? (editable ? "Düzenle" : "Belge") : "PDF Önizleme"}
						</button>
					))}
				</div>
			</div>

			{doc.status === "finalized" && (
				<Alert tone="warning">
					Bu belge sonlandırılmış durumda: içerik artık değiştirilemez, yalnızca PDF indirilebilir.
				</Alert>
			)}
			{doc.status === "draft" && team && !team.is_writable && (
				<Alert tone="warning">
					Ücretsiz deneme süreniz doldu. Belgeyi düzenlemek için aboneliğinizi yeniden başlatın.
				</Alert>
			)}

			{viewMode === "edit" ? (
				<>
					{editable && (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<FormField label="Belge başlığı">
								<Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
							</FormField>
							<FormField label="Kapak alt başlığı">
								<Input value={subtitle} onChange={(e) => { setSubtitle(e.target.value); setDirty(true); }} />
							</FormField>
						</div>
					)}

					<div className="rounded-2xl bg-base-200 border border-base-300 px-3 sm:px-6 pt-2">
						<ContractEditor
							initialDoc={liveContent ?? doc.content}
							palette={branding?.palette ?? BRAND_PALETTES.kagu}
							editable={editable}
							apiRef={editorApi}
							onChangeJson={(json) => setLiveContent(json)}
							onDirty={() => setDirty(true)}
							onInvalidContent={() => {
								const built = buildInitialDoc(
									doc.kind,
									doc.source_data,
									branding?.teamName ?? "Kagu Real Estate",
								);
								setLiveContent(built);
								editorApi.current?.setContent(built);
								setDirty(true);
								toast.error("Belge içeriği okunamadı — şablondan yeniden oluşturuldu. Kaydetmeden önce kontrol edin.");
							}}
							onReset={editable ? () => setConfirming("reset") : undefined}
						/>
					</div>
				</>
			) : (
				<div className="h-[60vh] sm:h-[72vh] bg-base-200 rounded-2xl overflow-hidden border border-base-300">
					{previewJson && (
						<PDFBlobProvider
							document={
								<EditorPDFDocument
									kind={doc.kind}
									title={title.trim() || doc.title}
									subtitle={subtitle.trim() || null}
									doc={previewJson}
									sourceData={doc.source_data}
									branding={branding}
								/>
							}
						>
							{({ url, loading, error: blobError }) => {
								if (loading || !url) {
									return <div className="h-full flex items-center justify-center"><Spinner /></div>;
								}
								if (blobError) {
									return (
										<div className="h-full flex items-center justify-center text-sm text-error p-6">
											Önizleme oluşturulamadı: {String(blobError)}
										</div>
									);
								}
								return (
									<iframe
										src={`${url}#toolbar=0&navpanes=0`}
										className="w-full h-full border-0"
										title="Sözleşme önizleme"
									/>
								);
							}}
						</PDFBlobProvider>
					)}
				</div>
			)}

			<div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-1">
				{editable && (
					<Button variant="outline" loading={busy === "save"} disabled={busy !== null || !dirty} onClick={onSave}>
						<Save className="w-4 h-4" /> Kaydet
					</Button>
				)}
				<Button variant="outline" loading={busy === "pdf"} disabled={busy !== null} onClick={onDownload}>
					<Download className="w-4 h-4" /> {editable ? "PDF indir ve arşivi güncelle" : "PDF indir"}
				</Button>
				{editable && (
					<Button loading={busy === "finalize"} disabled={busy !== null} onClick={() => setConfirming("finalize")}>
						<Lock className="w-4 h-4" /> Sonlandır
					</Button>
				)}
			</div>

			<ConfirmDialog
				open={confirming === "finalize"}
				title="Belge sonlandırılsın mı?"
				message="Sonlandırılan belge bir daha düzenlenemez; son hali PDF olarak indirilir ve arşivdeki kopya güncellenir. Bu işlem geri alınamaz."
				confirmLabel="Sonlandır"
				cancelLabel="Vazgeç"
				onConfirm={onFinalizeConfirmed}
				onCancel={() => setConfirming(null)}
			/>
			<ConfirmDialog
				open={confirming === "reset"}
				title="Belge şablona sıfırlansın mı?"
				message="Bu belgede yaptığınız tüm metin ve blok değişiklikleri silinir; belge, oluşturulduğu bilgilerle yeniden kurulur."
				confirmLabel="Sıfırla"
				cancelLabel="Vazgeç"
				onConfirm={onResetConfirmed}
				onCancel={() => setConfirming(null)}
			/>
		</div>
	);
}
