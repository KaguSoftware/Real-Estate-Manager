"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAppStore, useTeamReady } from "@/src/store";
import {
	listContractDocuments,
	type ContractDocumentListItem,
	type ContractDocKind,
	type ContractDocStatus,
} from "@/src/lib/db/contractDocuments";
import { getDocumentUrl } from "@/src/lib/db/documents";
import { useCachedResource } from "@/src/lib/useCachedResource";
import {
	AppShell, Card, Alert, Button, Input, Dropdown, Badge,
	SpinnerBlock, EmptyState, Pagination, usePagination, toast,
	BulkActionBar,
	type DropdownOption,
} from "@/src/components/ui";
import { useMultiSelect } from "@/src/hooks/useMultiSelect";
import { humanizeError } from "@/src/lib/errors";
import { FileText, Search, Download, FilePlus2, PencilLine } from "lucide-react";

function fmtDate(d: string) {
	return new Date(d).toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
}

const KIND_OPTIONS: DropdownOption<ContractDocKind | "">[] = [
	{ value: "", label: "Tüm türler" },
	{ value: "rental", label: "Kira" },
	{ value: "sales", label: "Satış" },
];

const STATUS_OPTIONS: DropdownOption<ContractDocStatus | "">[] = [
	{ value: "", label: "Tüm durumlar" },
	{ value: "draft", label: "Taslak" },
	{ value: "finalized", label: "Kesinleşmiş" },
];

function KindBadge({ kind }: { kind: ContractDocKind }) {
	return kind === "rental" ? <Badge tone="indigo">Kira</Badge> : <Badge tone="violet">Satış</Badge>;
}

function StatusBadge({ status }: { status: ContractDocStatus }) {
	return status === "finalized" ? <Badge tone="emerald">Kesinleşmiş</Badge> : <Badge tone="amber">Taslak</Badge>;
}

/** /documents — every contract document the team produced, filterable by
 *  tür (kira/satış), durum (taslak/kesin) and title search. */
export function DocumentsDashboard() {
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const [q, setQ] = useState("");
	const [debouncedQ, setDebouncedQ] = useState("");
	const [kind, setKind] = useState<ContractDocKind | "">("");
	const [status, setStatus] = useState<ContractDocStatus | "">("");
	const [downloadingId, setDownloadingId] = useState<string | null>(null);

	const debounceTimer = useRef<number | undefined>(undefined);
	function onSearchChange(value: string) {
		setQ(value);
		window.clearTimeout(debounceTimer.current);
		debounceTimer.current = window.setTimeout(() => setDebouncedQ(value), 300);
	}

	const filter = {
		q: debouncedQ || undefined,
		kind: kind === "" ? undefined : kind,
		status: status === "" ? undefined : status,
	};
	const cacheKey = user && teamReady ? `contract-documents:${JSON.stringify(filter)}` : null;
	const { data, loading, error, refetch } = useCachedResource(
		cacheKey,
		() => listContractDocuments(filter),
		undefined,
		{ enabled: !!user && teamReady },
	);
	const docs = data ?? [];
	const { page, setPage, pageCount, pageItems, total, pageSize } = usePagination(docs);

	// Bulk selection covers only downloadable rows (a saved PDF exists);
	// contract documents have no bulk-delete API.
	const { selected, toggle, toggleAll, clear, isSelected, allSelected, count } = useMultiSelect();
	const [bulkDownloading, setBulkDownloading] = useState(false);
	const pageIds = pageItems.filter((d) => d.pdf_path).map((d) => d.id);

	async function bulkDownload() {
		const selectedDocs = docs.filter((d) => selected.has(d.id) && d.pdf_path);
		setBulkDownloading(true);
		let failed = 0;
		for (const d of selectedDocs) {
			try {
				// Same source as the per-row download, but fetched to a blob and
				// saved via an anchor so multiple files don't trip popup blockers.
				const url = await getDocumentUrl(d.pdf_path!);
				const res = await fetch(url);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const blob = await res.blob();
				const objectUrl = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = objectUrl;
				a.download = `${d.title}.pdf`;
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(objectUrl);
			} catch {
				failed++;
			}
		}
		setBulkDownloading(false);
		clear();
		if (failed === 0) toast.success(`${selectedDocs.length} belge indirildi.`);
		else toast.error(`${selectedDocs.length - failed} belge indirildi, ${failed} belge indirilemedi.`);
	}

	async function onDownload(doc: ContractDocumentListItem) {
		if (!doc.pdf_path) return;
		setDownloadingId(doc.id);
		try {
			const url = await getDocumentUrl(doc.pdf_path);
			window.open(url, "_blank", "noopener");
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setDownloadingId(null);
		}
	}

	const hasFilter = debouncedQ !== "" || kind !== "" || status !== "";

	return (
		<AppShell title="Belgeler" subtitle="Oluşturulan sözleşmeler ve belgeler" width="7xl">
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-sm text-base-content/70">Belgelerinizi görmek için giriş yapın.</p>
					<p className="text-xs text-base-content/50 mt-1">Üst çubuktaki Giriş yap düğmesini kullanın.</p>
				</Card>
			) : (
				<>
					<div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
						<div className="relative flex-1 min-w-0">
							<Search className="w-4 h-4 text-base-content/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
							<Input
								placeholder="Belge başlığı ara…"
								value={q}
								onChange={(e) => onSearchChange(e.target.value)}
								className="pl-9"
								aria-label="Belge ara"
							/>
						</div>
						<div className="sm:w-40">
							<Dropdown
								options={KIND_OPTIONS}
								value={kind}
								onChange={setKind}
								aria-label="Belge türü"
							/>
						</div>
						<div className="sm:w-44">
							<Dropdown
								options={STATUS_OPTIONS}
								value={status}
								onChange={setStatus}
								aria-label="Belge durumu"
							/>
						</div>
						<Link href="/documents/new" className="hidden sm:block sm:ml-auto shrink-0">
							<Button size="sm">
								<FilePlus2 className="w-4 h-4" />
								Yeni belge
							</Button>
						</Link>
					</div>

					{error && (
						<Alert
							className="mb-4"
							action={<Button size="sm" variant="outline" onClick={refetch}>Tekrar dene</Button>}
						>
							Belgeler yüklenemedi: {error}
						</Alert>
					)}

					{loading ? (
						<SpinnerBlock />
					) : docs.length === 0 ? (
						<Card>
							<EmptyState
								icon={FileText}
								title={hasFilter ? "Eşleşen belge yok" : "Henüz belge yok"}
								hint={
									hasFilter
										? "Filtreleri değiştirerek yeniden deneyin."
										: "Yeni belge sihirbazıyla kira veya satış sözleşmesi oluşturduğunuzda burada listelenir."
								}
							/>
						</Card>
					) : (
						<>
							{/* Mobile: card list */}
							<div className="block sm:hidden space-y-3">
								{pageItems.map((d) => (
									<Link
										key={d.id}
										href={`/documents/${d.id}`}
										className="block bg-base-100 border border-base-300 rounded-2xl shadow-card p-4 active:bg-base-200 transition-colors"
									>
										<div className="flex items-start justify-between gap-3">
											{d.pdf_path && (
												<input
													type="checkbox"
													checked={isSelected(d.id)}
													// preventDefault stops the surrounding Link from navigating;
													// checked state is controlled so the box still toggles.
													onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(d.id); }}
													onChange={() => {}}
													aria-label={`${d.title} belgesini seç`}
													className="checkbox checkbox-sm checkbox-primary mt-1 shrink-0"
												/>
											)}
											<div className="min-w-0 flex-1">
												<p className="text-base font-bold text-base-content truncate">{d.title}</p>
												{d.subtitle && <p className="text-sm text-base-content/60 mt-0.5 truncate">{d.subtitle}</p>}
											</div>
											<KindBadge kind={d.kind} />
										</div>
										<div className="mt-3 flex items-center justify-between gap-2">
											<StatusBadge status={d.status} />
											<span className="text-xs text-base-content/50">Güncellendi: {fmtDate(d.updated_at)}</span>
										</div>
									</Link>
								))}
							</div>

							{/* Desktop: table */}
							<Card padded={false} className="hidden sm:block overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full min-w-140 text-sm">
										<thead className="bg-base-200/60 border-b border-base-300">
											<tr>
												<th className="px-4 py-3 w-10">
													<input
														type="checkbox"
														checked={allSelected(pageIds)}
														onChange={() => toggleAll(pageIds)}
														disabled={pageIds.length === 0}
														aria-label="Sayfadaki tüm belgeleri seç"
														className="checkbox checkbox-sm checkbox-primary align-middle"
													/>
												</th>
												<th className="text-left px-4 py-3 text-xs font-semibold text-base-content/50">Başlık</th>
												<th className="text-left px-4 py-3 text-xs font-semibold text-base-content/50">Tür</th>
												<th className="text-left px-4 py-3 text-xs font-semibold text-base-content/50">Durum</th>
												<th className="text-left px-4 py-3 text-xs font-semibold text-base-content/50">Oluşturulma</th>
												<th className="text-left px-4 py-3 text-xs font-semibold text-base-content/50">Güncellendi</th>
												<th className="text-left px-4 py-3 text-xs font-semibold text-base-content/50">
													<span className="sr-only">İşlemler</span>
												</th>
											</tr>
										</thead>
										<tbody>
											{pageItems.map((d) => (
												<tr key={d.id} className="border-b border-base-300 last:border-0 hover:bg-base-200 transition-colors">
													<td className="px-4 py-3 w-10">
														{d.pdf_path && (
															<input
																type="checkbox"
																checked={isSelected(d.id)}
																onChange={() => toggle(d.id)}
																aria-label={`${d.title} belgesini seç`}
																className="checkbox checkbox-sm checkbox-primary align-middle"
															/>
														)}
													</td>
													<td className="px-4 py-3">
														<Link href={`/documents/${d.id}`} className="block">
															<span className="text-sm font-medium text-base-content hover:underline">{d.title}</span>
															{d.subtitle && <span className="block text-xs text-base-content/50 truncate max-w-xs">{d.subtitle}</span>}
														</Link>
													</td>
													<td className="px-4 py-3"><KindBadge kind={d.kind} /></td>
													<td className="px-4 py-3"><StatusBadge status={d.status} /></td>
													<td className="px-4 py-3 text-sm text-base-content/60 whitespace-nowrap">{fmtDate(d.created_at)}</td>
													<td className="px-4 py-3 text-sm text-base-content/60 whitespace-nowrap">{fmtDate(d.updated_at)}</td>
													<td className="px-4 py-3 text-right whitespace-nowrap">
														<span className="inline-flex items-center gap-1">
															<Link
																href={`/documents/${d.id}`}
																aria-label={`${d.title} belgesini aç`}
																title="Belgeyi aç"
																className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-base-content/80 hover:bg-base-200 transition-colors"
															>
																<PencilLine className="w-4 h-4" />
															</Link>
															{d.pdf_path && (
																<button
																	type="button"
																	onClick={() => onDownload(d)}
																	disabled={downloadingId === d.id}
																	aria-label={`${d.title} PDF indir`}
																	title="Kaydedilen PDF'i aç"
																	className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-base-content/80 hover:bg-base-200 transition-colors disabled:opacity-50"
																>
																	<Download className="w-4 h-4" />
																</button>
															)}
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</Card>
							<Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPageChange={setPage} />

							<BulkActionBar count={count} label={`${count} belge seçildi`} onClear={clear}>
								<Button size="sm" variant="outline" loading={bulkDownloading} onClick={bulkDownload}>
									<Download className="w-4 h-4" />
									İndir
								</Button>
							</BulkActionBar>
						</>
					)}
				</>
			)}
		</AppShell>
	);
}
