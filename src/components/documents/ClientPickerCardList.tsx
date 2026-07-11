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
			<div className="text-center py-12 bg-base-200 rounded-2xl border border-dashed border-base-300">
				<p className="text-sm text-base-content/60 mb-2">Henüz müşteri yok.</p>
				{emptyHint && <p className="text-xs text-base-content/50 px-6">{emptyHint}</p>}
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
								: "border-base-300 bg-base-100 hover:border-base-content/30 active:bg-base-200",
						)}
					>
						<p className="text-sm font-bold text-base-content truncate">{c.full_name}</p>
						<p className="text-sm text-base-content/60 truncate mt-0.5">
							{c.phone ?? c.email ?? "İletişim bilgisi yok"}
						</p>
						{c.interested_in && (
							<p className="text-xs text-base-content/50 truncate mt-1">{c.interested_in}</p>
						)}
					</button>
				);
			})}
		</div>
	);
}
