"use client";

import Link from "next/link";
import type { Property } from "@/src/lib/db/types";
import { cn } from "@/src/components/ui";

interface Props {
	properties: Property[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	emptyHint?: string;
}

function fmt(p: number | null, ccy: string) {
	return p == null ? "—" : `${p.toFixed(0)} ${ccy}`;
}

export function PropertyPickerCardList({ properties, selectedId, onSelect, emptyHint }: Props) {
	if (properties.length === 0) {
		return (
			<div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
				<p className="text-sm text-slate-500 mb-2">No eligible properties.</p>
				{emptyHint && <p className="text-xs text-slate-400 mb-4 px-6">{emptyHint}</p>}
				<Link
					href="/properties/new"
					className="inline-flex items-center h-11 px-4 text-sm font-semibold rounded-xl bg-primary text-primary-content hover:brightness-110 transition-all shadow-soft"
				>
					+ Add property
				</Link>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
			{properties.map((p) => {
				const selected = p.id === selectedId;
				return (
					<button
						key={p.id}
						type="button"
						onClick={() => onSelect(p.id)}
						className={cn(
							"text-left p-4 rounded-2xl border transition-all shadow-soft",
							selected
								? "border-primary bg-primary/5 ring-2 ring-primary/20"
								: "border-slate-200 bg-white hover:border-slate-400 active:bg-slate-50",
						)}
					>
						<p className="text-sm font-bold text-slate-900 truncate">{p.address_line}</p>
						<p className="text-sm text-slate-500 truncate mt-0.5">
							{p.city ?? "—"}
							{p.size_sqm ? ` · ${p.size_sqm} m²` : ""}
						</p>
						<div className="mt-2 flex items-center justify-between gap-2 text-sm">
							<span className="text-slate-500 truncate">Owner: {p.homeowner_name}</span>
							<span className="font-semibold text-slate-700 whitespace-nowrap">{fmt(p.list_price, p.currency)}</span>
						</div>
					</button>
				);
			})}
		</div>
	);
}
