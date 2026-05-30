import { create } from "zustand";
import type { Property, PropertyStatus, ListingType, Lead, LeadStatus } from "@/src/lib/db/types";

export interface UserProfile {
	id: string;
	email: string;
	app_role?: "admin" | "member" | "client";
}

export type FurnishedFilter = "all" | "yes" | "no";

interface Filters {
	listing_type: ListingType | "all";
	status: PropertyStatus | "all";
	q: string;
	nitelik: string[];
	furnished: FurnishedFilter;
	location: string[];
}

const EMPTY_FILTERS: Filters = {
	listing_type: "all",
	status: "all",
	q: "",
	nitelik: [],
	furnished: "all",
	location: [],
};

interface LeadFilters {
	status: LeadStatus | "all";
	q: string;
}

const EMPTY_LEAD_FILTERS: LeadFilters = { status: "all", q: "" };

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
	/** Replace several filter values at once (e.g. lead "Find matches"). */
	setFilters: (patch: Partial<Filters>) => void;
	resetFilters: () => void;

	leads: Lead[];
	setLeads: (l: Lead[]) => void;
	upsertLead: (l: Lead) => void;
	removeLead: (id: string) => void;
	isLoadingLeads: boolean;
	setIsLoadingLeads: (v: boolean) => void;

	leadFilters: LeadFilters;
	setLeadFilter: <K extends keyof LeadFilters>(k: K, v: LeadFilters[K]) => void;
	resetLeadFilters: () => void;
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

	filters: { ...EMPTY_FILTERS },
	setFilter: (k, v) => set((s) => ({ filters: { ...s.filters, [k]: v } })),
	setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
	resetFilters: () => set({ filters: { ...EMPTY_FILTERS } }),

	leads: [],
	setLeads: (leads) => set({ leads }),
	upsertLead: (l) =>
		set((s) => {
			const idx = s.leads.findIndex((x) => x.id === l.id);
			return {
				leads:
					idx === -1
						? [l, ...s.leads]
						: s.leads.map((x) => (x.id === l.id ? l : x)),
			};
		}),
	removeLead: (id) =>
		set((s) => ({ leads: s.leads.filter((l) => l.id !== id) })),
	isLoadingLeads: false,
	setIsLoadingLeads: (v) => set({ isLoadingLeads: v }),

	leadFilters: { ...EMPTY_LEAD_FILTERS },
	setLeadFilter: (k, v) => set((s) => ({ leadFilters: { ...s.leadFilters, [k]: v } })),
	resetLeadFilters: () => set({ leadFilters: { ...EMPTY_LEAD_FILTERS } }),
}));
