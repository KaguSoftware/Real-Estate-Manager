"use client";

import type { Lead } from "@/src/lib/db/types";
import { cn } from "@/src/components/ui";

interface Props {
	clients: Lead[];
	selectedId: string | null;
	onSelect: (id: string | null) => void;
	emptyHint?: string;
}

/**
 * Card grid for picking a client (lead) in the document wizard — mirrors
 * PropertyPickerCardList. Selecting a card fills in the party's contact details
 * downstream; the picker is optional, so re-clicking a selected card deselects it.
 */
export function ClientPickerCardList({ clients, selectedId, onSelect, emptyHint }: Props) {
	if (clients.length === 0) {
		return (
			<div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
				<p className="text-sm text-slate-500 mb-2">No clients yet.</p>
				{emptyHint && <p className="text-xs text-slate-400 px-6">{emptyHint}</p>}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
			{clients.map((c) => {
				const selected = c.id === selectedId;
				return (
					<button
						key={c.id}
						type="button"
						onClick={() => onSelect(selected ? null : c.id)}
						className={cn(
							"text-left p-4 rounded-2xl border transition-all shadow-soft",
							selected
								? "border-primary bg-primary/5 ring-2 ring-primary/20"
								: "border-slate-200 bg-white hover:border-slate-400 active:bg-slate-50",
						)}
					>
						<p className="text-sm font-bold text-slate-900 truncate">{c.full_name}</p>
						<p className="text-sm text-slate-500 truncate mt-0.5">
							{c.phone ?? c.email ?? "No contact info"}
						</p>
						{c.interested_in && (
							<p className="text-xs text-slate-400 truncate mt-1">{c.interested_in}</p>
						)}
					</button>
				);
			})}
		</div>
	);
}
