"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/src/store";
import type { LeadStatus } from "@/src/lib/db/types";
import { LEAD_STATUS_META, LEAD_STATUS_ORDER } from "./leadStatus";
import { Input, Select, Button } from "@/src/components/ui";
import { Search, Plus } from "lucide-react";

export function LeadFilters({ onAdd }: { onAdd?: () => void }) {
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
		<div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
			<div className="relative flex-1 min-w-0">
				<Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
				<Input
					placeholder="Search name, phone, interest…"
					value={q}
					onChange={(e) => setQ(e.target.value)}
					className="pl-9"
				/>
			</div>

			<Select
				value={leadFilters.status}
				onChange={(e) => setLeadFilter("status", e.target.value as LeadStatus | "all")}
				className="sm:w-52"
			>
				<option value="all">All statuses</option>
				{LEAD_STATUS_ORDER.map((s) => (
					<option key={s} value={s}>{LEAD_STATUS_META[s].label}</option>
				))}
			</Select>

			{hasActiveFilter && (
				<Button variant="ghost" size="sm" onClick={() => { setQ(""); resetLeadFilters(); }}>
					Clear
				</Button>
			)}

			{onAdd && (
				<Button size="sm" onClick={onAdd} className="hidden sm:inline-flex sm:ml-auto shrink-0">
					<Plus className="w-4 h-4" />
					Add client
				</Button>
			)}
		</div>
	);
}
