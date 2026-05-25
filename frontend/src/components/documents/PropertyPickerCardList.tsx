"use client";

import Link from "next/link";
import type { Property } from "@/src/lib/db/types";

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
				{emptyHint && <p className="text-xs text-slate-400 mb-4">{emptyHint}</p>}
				<Link
					href="/properties/new"
					className="inline-block px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity"
				>
					+ Add property
				</Link>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
			{properties.map((p) => {
				const selected = p.id === selectedId;
				return (
					<button
						key={p.id}
						type="button"
						onClick={() => onSelect(p.id)}
						className={`text-left p-4 rounded-xl border transition-all ${
							selected
								? "border-primary bg-primary/5 ring-2 ring-primary/20"
								: "border-slate-200 bg-white hover:border-slate-400"
						}`}
					>
						<p className="text-xs font-bold text-slate-900 truncate">{p.address_line}</p>
						<p className="text-[11px] text-slate-500 truncate mt-0.5">
							{p.city ?? "—"}
							{p.size_sqm ? ` · ${p.size_sqm} m²` : ""}
						</p>
						<div className="mt-2 flex items-center justify-between text-[11px]">
							<span className="text-slate-500">Owner: {p.homeowner_name}</span>
							<span className="font-semibold text-slate-700">{fmt(p.list_price, p.currency)}</span>
						</div>
					</button>
				);
			})}
		</div>
	);
}
