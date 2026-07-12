"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/src/store";
import {
	listContractDocuments,
	type ContractDocumentListItem,
	type ContractDocKind,
	type ContractDocStatus,
} from "@/src/lib/db/contractDocuments";
import { getDocumentUrl } from "@/src/lib/db/documents";
import { useCachedResource } from "@/src/lib/useCachedResource";
import {
	AppShell, Card, Alert, Button, Input, Select, Badge,
	SpinnerBlock, EmptyState, Pagination, usePagination, toast,
} from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";
import { FileText, Search, Download, FilePlus2, PencilLine } from "lucide-react";

function fmtDate(d: string) {
	return new Date(d).toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
}

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
	const [q, setQ] = useState("");
	const [debouncedQ, setDebouncedQ] = useState("");
	const [kind, setKind] = useState<ContractDocKind | "all">("all");
	const [status, setStatus] = useState<ContractDocStatus | "all">("all");
	const [downloadingId, setDownloadingId] = useState<string | null>(null);

	const debounceTimer = useRef<number | undefined>(undefined);
	function onSearchChange(value: string) {
		setQ(value);
		window.clearTimeout(debounceTimer.current);
		debounceTimer.current = window.setTimeout(() => setDebouncedQ(value), 300);
	}

	const filter = {
		q: debouncedQ || undefined,
		kind: kind === "all" ? undefined : kind,
		status: status === "all" ? undefined : status,
	};
	const cacheKey = user ? `contract-documents:${JSON.stringify(filter)}` : null;
	const { data, loading, error, refetch } = useCachedResource(
		cacheKey,
		() => listContractDocuments(filter),
		undefined,
		{ enabled: !!user },
	);
	const docs = data ?? [];
	const { page, setPage, pageCount, pageItems, total, pageSize } = usePagination(docs);

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

	const hasFilter = debouncedQ !== "" || kind !== "all" || status !== "all";

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
						<Select
							value={kind}
							onChange={(e) => setKind(e.target.value as ContractDocKind | "all")}
							className="sm:w-40"
							aria-label="Belge türü"
						>
							<option value="all">Tüm türler</option>
							<option value="rental">Kira</option>
							<option value="sales">Satış</option>
						</Select>
						<Select
							value={status}
							onChange={(e) => setStatus(e.target.value as ContractDocStatus | "all")}
							className="sm:w-44"
							aria-label="Belge durumu"
						>
							<option value="all">Tüm durumlar</option>
							<option value="draft">Taslak</option>
							<option value="finalized">Kesinleşmiş</option>
						</Select>
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
						</>
					)}
				</>
			)}
		</AppShell>
	);
}
