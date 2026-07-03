"use client";

import type { Tenant } from "@/src/lib/db/types";
import { Card, SpinnerBlock, EmptyState } from "@/src/components/ui";
import { WhatsAppButton } from "@/src/components/ui/WhatsAppButton";
import { Users, Pencil } from "lucide-react";

interface Props {
	tenants: Tenant[];
	loading: boolean;
	onEdit: (tenant: Tenant) => void;
}

function fmtDate(d: string) {
	return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function TenantTable({ tenants, loading, onEdit }: Props) {
	if (loading) return <SpinnerBlock />;

	if (tenants.length === 0) {
		return (
			<Card>
				<EmptyState
					icon={Users}
					title="No tenants yet"
					hint="Tenants are created here or automatically when you generate a rental or sales agreement."
				/>
			</Card>
		);
	}

	const headerCls = "text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400";

	return (
		<>
			{/* Mobile: card list */}
			<div className="block sm:hidden space-y-3">
				{tenants.map((t) => (
					// div (not button) so the WhatsApp link can live inside without
					// invalid interactive nesting.
					<div
						key={t.id}
						role="button"
						tabIndex={0}
						onClick={() => onEdit(t)}
						onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(t); } }}
						className="w-full text-left bg-white border border-slate-200/80 rounded-2xl shadow-card p-4 active:bg-slate-50 transition-colors cursor-pointer"
					>
						<p className="text-base font-bold text-slate-900 truncate">{t.full_name}</p>
						{(t.phone || t.email) && (
							<p className="text-sm text-slate-500 mt-0.5 truncate">
								{t.phone ?? ""}
								{t.phone && <WhatsAppButton phone={t.phone} name={t.full_name} />}
								{t.phone && t.email ? " · " : ""}
								{t.email ?? ""}
							</p>
						)}
						<p className="text-xs text-slate-400 mt-2">Added {fmtDate(t.created_at)}</p>
					</div>
				))}
			</div>

			{/* Desktop: table */}
			<Card padded={false} className="hidden sm:block overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full min-w-140 text-sm">
						<thead className="bg-slate-50/60 border-b border-slate-100">
							<tr>
								<th className={headerCls}>Name</th>
								<th className={headerCls}>Phone</th>
								<th className={headerCls}>Email</th>
								<th className={headerCls}>National ID</th>
								<th className={headerCls}>Added</th>
								<th className={headerCls}><span className="sr-only">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{tenants.map((t) => (
								<tr
									key={t.id}
									onClick={() => onEdit(t)}
									className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
								>
									<td className="px-4 py-3 text-sm font-medium text-slate-800">{t.full_name}</td>
									<td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
										{t.phone ?? "—"}
										{t.phone && <span className="ml-1"><WhatsAppButton phone={t.phone} name={t.full_name} /></span>}
									</td>
									<td className="px-4 py-3 text-sm text-slate-600">{t.email ?? "—"}</td>
									<td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{t.national_id ?? "—"}</td>
									<td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{fmtDate(t.created_at)}</td>
									<td className="px-4 py-3 text-right whitespace-nowrap">
										<button
											type="button"
											onClick={(e) => { e.stopPropagation(); onEdit(t); }}
											aria-label={`Edit ${t.full_name}`}
											title="Edit or delete this tenant"
											className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
		</>
	);
}
