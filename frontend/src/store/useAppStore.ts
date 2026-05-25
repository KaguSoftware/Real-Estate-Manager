import { create } from "zustand";
import type { Property, PropertyStatus, ListingType } from "@/src/lib/db/types";

export interface UserProfile {
	id: string;
	email: string;
	app_role?: "admin" | "member" | "client";
}

interface Filters {
	listing_type: ListingType | "all";
	status: PropertyStatus | "all";
	q: string;
}

interface AppState {
	user: UserProfile | null;
	setUser: (u: UserProfile | null) => void;

	properties: Property[];
	setProperties: (p: Property[]) => void;
	upsertProperty: (p: Property) => void;
	removeProperty: (id: string) => void;
	isLoadingProperties: boolean;
	setIsLoadingProperties: (v: boolean) => void;

	filters: Filters;
	setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
	resetFilters: () => void;

	selectedPropertyId: string | null;
	selectProperty: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
	user: null,
	setUser: (user) => set({ user }),

	properties: [],
	setProperties: (properties) => set({ properties }),
	upsertProperty: (p) =>
		set((s) => {
			const idx = s.properties.findIndex((x) => x.id === p.id);
			return {
				properties:
					idx === -1
						? [p, ...s.properties]
						: s.properties.map((x) => (x.id === p.id ? p : x)),
			};
		}),
	removeProperty: (id) =>
		set((s) => ({ properties: s.properties.filter((p) => p.id !== id) })),
	isLoadingProperties: false,
	setIsLoadingProperties: (v) => set({ isLoadingProperties: v }),

	filters: { listing_type: "all", status: "all", q: "" },
	setFilter: (k, v) => set((s) => ({ filters: { ...s.filters, [k]: v } })),
	resetFilters: () => set({ filters: { listing_type: "all", status: "all", q: "" } }),

	selectedPropertyId: null,
	selectProperty: (id) => set({ selectedPropertyId: id }),
}));
