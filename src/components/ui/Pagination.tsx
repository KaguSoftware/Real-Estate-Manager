"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_PAGE_SIZE = 25;

/**
 * Client-side pagination over an already-loaded list. Lists here flow through
 * the zustand store and feed the map, CSV export, filter facets, and match
 * counts, so the full dataset must stay loaded — this only windows what a
 * table renders. Resets to page 1 whenever the underlying list changes shape.
 */
export function usePagination<T>(items: T[], pageSize: number = DEFAULT_PAGE_SIZE) {
	const [rawPage, setPage] = useState(1);
	const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
	// Clamp during render (no setState-in-effect) so the view stays valid when
	// items shrink after a filter change or deletion.
	const page = Math.min(rawPage, pageCount);

	const pageItems = useMemo(
		() => items.slice((page - 1) * pageSize, page * pageSize),
		[items, page, pageSize],
	);

	return { page, setPage, pageCount, pageItems, total: items.length, pageSize };
}

interface PaginationProps {
	page: number;
	pageCount: number;
	total: number;
	pageSize: number;
	onPageChange: (page: number) => void;
	className?: string;
}

export function Pagination({ page, pageCount, total, pageSize, onPageChange, className }: PaginationProps) {
	if (pageCount <= 1) return null;
	const from = (page - 1) * pageSize + 1;
	const to = Math.min(page * pageSize, total);

	return (
		<div className={`flex items-center justify-between gap-3 px-1 py-3 text-sm ${className ?? ""}`}>
			<span className="text-xs text-base-content/50">
				{from}–{to} · toplam {total}
			</span>
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={() => onPageChange(page - 1)}
					disabled={page <= 1}
					aria-label="Önceki sayfa"
					className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-base-content/60 hover:bg-base-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
				>
					<ChevronLeft className="w-4 h-4" />
				</button>
				<span className="text-xs font-medium text-base-content/70 tabular-nums px-1">
					{page} / {pageCount}
				</span>
				<button
					type="button"
					onClick={() => onPageChange(page + 1)}
					disabled={page >= pageCount}
					aria-label="Sonraki sayfa"
					className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-base-content/60 hover:bg-base-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
				>
					<ChevronRight className="w-4 h-4" />
				</button>
			</div>
		</div>
	);
}
