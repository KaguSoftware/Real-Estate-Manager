"use client";

import type { Tenant } from "@/src/lib/db/types";
import { Card, SpinnerBlock, EmptyState, Pagination, usePagination } from "@/src/components/ui";
import { WhatsAppButton } from "@/src/components/ui/WhatsAppButton";
import { Users, Pencil } from "lucide-react";

interface Props {
	tenants: Tenant[];
	loading: boolean;
	onEdit: (tenant: Tenant) => void;
}

function fmtDate(d: string) {
	return new Date(d).toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
}

export function TenantTable({ tenants, loading, onEdit }: Props) {
	const { page, setPage, pageCount, pageItems, total, pageSize } = usePagination(tenants);
	if (loading) return <SpinnerBlock />;

	if (tenants.length === 0) {
		return (
			<Card>
				<EmptyState
					icon={Users}
					title="Henüz kiracı yok"
					hint="Kiracılar burada veya bir kira ya da satış sözleşmesi oluşturduğunuzda otomatik olarak eklenir."
				/>
			</Card>
		);
	}

	const headerCls = "text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-base-content/50";

	return (
		<>
			{/* Mobile: card list */}
			<div className="block sm:hidden space-y-3">
				{pageItems.map((t) => (
					// div (not button) so the WhatsApp link can live inside without
					// invalid interactive nesting.
					<div
						key={t.id}
						role="button"
						tabIndex={0}
						onClick={() => onEdit(t)}
						onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(t); } }}
						className="w-full text-left bg-base-100 border border-base-300 rounded-2xl shadow-card p-4 active:bg-base-200 transition-colors cursor-pointer"
					>
						<p className="text-base font-bold text-base-content truncate">{t.full_name}</p>
						{(t.phone || t.email) && (
							<p className="text-sm text-base-content/60 mt-0.5 truncate">
								{t.phone ?? ""}
								{t.phone && <WhatsAppButton phone={t.phone} name={t.full_name} />}
								{t.phone && t.email ? " · " : ""}
								{t.email ?? ""}
							</p>
						)}
						<p className="text-xs text-base-content/50 mt-2">Eklenme: {fmtDate(t.created_at)}</p>
					</div>
				))}
			</div>

			{/* Desktop: table */}
			<Card padded={false} className="hidden sm:block overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full min-w-140 text-sm">
						<thead className="bg-base-200/60 border-b border-base-300">
							<tr>
								<th className={headerCls}>Ad soyad</th>
								<th className={headerCls}>Telefon</th>
								<th className={headerCls}>E-posta</th>
								<th className={headerCls}>TC Kimlik No</th>
								<th className={headerCls}>Eklenme tarihi</th>
								<th className={headerCls}><span className="sr-only">İşlemler</span></th>
							</tr>
						</thead>
						<tbody>
							{pageItems.map((t) => (
								<tr
									key={t.id}
									onClick={() => onEdit(t)}
									className="border-b border-base-300 last:border-0 hover:bg-base-200 transition-colors cursor-pointer"
								>
									<td className="px-4 py-3 text-sm font-medium text-base-content">{t.full_name}</td>
									<td className="px-4 py-3 text-sm text-base-content/70 whitespace-nowrap">
										{t.phone ?? "—"}
										{t.phone && <span className="ml-1"><WhatsAppButton phone={t.phone} name={t.full_name} /></span>}
									</td>
									<td className="px-4 py-3 text-sm text-base-content/70">{t.email ?? "—"}</td>
									<td className="px-4 py-3 text-sm text-base-content/70 whitespace-nowrap">{t.national_id ?? "—"}</td>
									<td className="px-4 py-3 text-sm text-base-content/60 whitespace-nowrap">{fmtDate(t.created_at)}</td>
									<td className="px-4 py-3 text-right whitespace-nowrap">
										<button
											type="button"
											onClick={(e) => { e.stopPropagation(); onEdit(t); }}
											aria-label={`${t.full_name} kaydını düzenle`}
											title="Bu kiracıyı düzenle veya sil"
											className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-base-content/50 hover:text-base-content/80 hover:bg-base-200 transition-colors"
										>
											<Pencil className="w-4 h-4" />
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>
			<Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPageChange={setPage} />
		</>
	);
}
