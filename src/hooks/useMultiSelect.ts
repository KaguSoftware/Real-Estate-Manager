"use client";

import { useCallback, useState } from "react";

/**
 * Generic multi-select state for list/table bulk actions. Holds a Set of
 * string ids; `toggleAll` works against whatever id list the caller passes
 * (typically the currently filtered+paged visible rows).
 */
export function useMultiSelect() {
	const [selected, setSelected] = useState<Set<string>>(() => new Set());

	const toggle = useCallback((id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	/** Select every id in `ids`; if all are already selected, deselect them. */
	const toggleAll = useCallback((ids: string[]) => {
		setSelected((prev) => {
			const next = new Set(prev);
			const all = ids.length > 0 && ids.every((id) => prev.has(id));
			for (const id of ids) {
				if (all) next.delete(id);
				else next.add(id);
			}
			return next;
		});
	}, []);

	const clear = useCallback(() => setSelected(new Set()), []);

	const isSelected = useCallback((id: string) => selected.has(id), [selected]);

	const allSelected = useCallback(
		(ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
		[selected],
	);

	return { selected, toggle, toggleAll, clear, isSelected, allSelected, count: selected.size };
}
