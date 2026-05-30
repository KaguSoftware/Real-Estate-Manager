"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/src/store";
import type { LeadStatus } from "@/src/lib/db/types";
import { LEAD_STATUS_META, LEAD_STATUS_ORDER } from "./leadStatus";

export function LeadFilters() {
	const leadFilters = useAppStore((s) => s.leadFilters);
	const setLeadFilter = useAppStore((s) => s.setLeadFilter);
	const resetLeadFilters = useAppStore((s) => s.resetLeadFilters);

	const [q, setQ] = useState(leadFilters.q);
	useEffect(() => {
		const id = setTimeout(() => {
			if (q !== leadFilters.q) setLeadFilter("q", q);
		}, 250);
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [q]);

	const hasActiveFilter = leadFilters.status !== "all" || leadFilters.q !== "";

	return (
		<div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
			<input
				type="text"
				placeholder="Search name, phone, interest…"
				value={q}
				onChange={(e) => setQ(e.target.value)}
				className="flex-1 min-w-0 w-full sm:w-auto px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
			/>

			<select
				value={leadFilters.status}
				onChange={(e) => setLeadFilter("status", e.target.value as LeadStatus | "all")}
				className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
			>
				<option value="all">All statuses</option>
				{LEAD_STATUS_ORDER.map((s) => (
					<option key={s} value={s}>{LEAD_STATUS_META[s].label}</option>
				))}
			</select>

			{hasActiveFilter && (
				<button
					onClick={() => { setQ(""); resetLeadFilters(); }}
					className="text-xs text-slate-500 hover:text-slate-800 transition-colors underline underline-offset-2"
				>
					Clear
				</button>
			)}
		</div>
	);
}
