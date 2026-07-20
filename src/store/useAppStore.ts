import { create } from "zustand";
import type { Property, PropertyStatus, ListingType, Lead, LeadStatus, Project } from "@/src/lib/db/types";
import type { TeamContext } from "@/src/lib/db/teams";
import { invalidateCache } from "@/src/lib/useCachedResource";

export interface UserProfile {
	id: string;
	email: string;
	app_role?: "admin" | "member" | "client";
	avatar_path?: string | null;
}

export type FurnishedFilter = "all" | "yes" | "no";

interface Filters {
	listing_type: ListingType | "all";
	status: PropertyStatus | "all";
	q: string;
	nitelik: string[];
	furnished: FurnishedFilter;
	location: string[];
	/** Budget bounds; null = open-ended. */
	min_price: number | null;
	max_price: number | null;
	/** Currency a price range applies to — prices are never FX-converted. */
	currency: string;
	/** "all" | "yes" (new build) | "no" (second-hand). */
	new_build: NewBuildFilter;
}

export type NewBuildFilter = "all" | "yes" | "no";

const EMPTY_FILTERS: Filters = {
	listing_type: "all",
	status: "all",
	q: "",
	nitelik: [],
	furnished: "all",
	location: [],
	min_price: null,
	max_price: null,
	currency: "TRY",
	new_build: "all",
};

interface LeadFilters {
	status: LeadStatus | "all";
	q: string;
}

const EMPTY_LEAD_FILTERS: LeadFilters = { status: "all", q: "" };

interface AppState {
	user: UserProfile | null;
	setUser: (u: UserProfile | null) => void;

	/** The signed-in user's team (null = not loaded yet or no team). */
	team: TeamContext | null;
	teamLoaded: boolean;
	setTeam: (t: TeamContext | null) => void;

	/** The rows currently VISIBLE — i.e. after the active filters are applied.
	 *  This is what the table and map render. */
	properties: Property[];
	setProperties: (p: Property[]) => void;
	/** Every property the team has, unfiltered. The filter bar builds its
	 *  dropdown options from this: deriving them from `properties` would make the
	 *  options collapse as you narrow, so picking one value would delete the
	 *  others from the list and you could never widen the selection again. */
	allProperties: Property[];
	setAllProperties: (p: Property[]) => void;
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

	projects: Project[];
	setProjects: (p: Project[]) => void;
	upsertProject: (p: Project) => void;
	removeProject: (id: string) => void;
	isLoadingProjects: boolean;
	setIsLoadingProjects: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
	user: null,
	setUser: (user) => set({ user }),

	team: null,
	teamLoaded: false,
	setTeam: (team) => set({ team, teamLoaded: true }),

	properties: [],
	setProperties: (properties) => set({ properties }),
	allProperties: [],
	setAllProperties: (allProperties) => set({ allProperties }),
	upsertProperty: (p) =>
		set((s) => {
			// A create/update may change which filtered queries this row belongs to,
			// so drop all cached property lists; the next visit refetches fresh.
			invalidateCache("properties");
			invalidateCache("stats");
			invalidateCache("attention");
			// Both lists are updated optimistically: `properties` so the visible
			// table reacts immediately, `allProperties` so the filter bar's options
			// include a brand-new property's city/nitelik right away.
			const upsert = (list: Property[]) =>
				list.some((x) => x.id === p.id)
					? list.map((x) => (x.id === p.id ? p : x))
					: [p, ...list];
			return { properties: upsert(s.properties), allProperties: upsert(s.allProperties) };
		}),
	removeProperty: (id) =>
		set((s) => {
			invalidateCache("properties");
			invalidateCache("stats");
			invalidateCache("attention");
			return {
				properties: s.properties.filter((p) => p.id !== id),
				allProperties: s.allProperties.filter((p) => p.id !== id),
			};
		}),
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
			invalidateCache("leads");
			invalidateCache("stats");
			invalidateCache("attention");
			const idx = s.leads.findIndex((x) => x.id === l.id);
			return {
				leads:
					idx === -1
						? [l, ...s.leads]
						: s.leads.map((x) => (x.id === l.id ? l : x)),
			};
		}),
	removeLead: (id) =>
		set((s) => {
			invalidateCache("leads");
			invalidateCache("stats");
			invalidateCache("attention");
			return { leads: s.leads.filter((l) => l.id !== id) };
		}),
	isLoadingLeads: false,
	setIsLoadingLeads: (v) => set({ isLoadingLeads: v }),

	leadFilters: { ...EMPTY_LEAD_FILTERS },
	setLeadFilter: (k, v) => set((s) => ({ leadFilters: { ...s.leadFilters, [k]: v } })),
	resetLeadFilters: () => set({ leadFilters: { ...EMPTY_LEAD_FILTERS } }),

	projects: [],
	setProjects: (projects) => set({ projects }),
	upsertProject: (p) =>
		set((s) => {
			invalidateCache("projects");
			const idx = s.projects.findIndex((x) => x.id === p.id);
			return {
				projects:
					idx === -1
						? [p, ...s.projects]
						: s.projects.map((x) => (x.id === p.id ? p : x)),
			};
		}),
	removeProject: (id) =>
		set((s) => {
			invalidateCache("projects");
			// projects.id is ON DELETE SET NULL on properties.project_id, so any
			// cached property list may still show a stale project link.
			invalidateCache("properties");
			return { projects: s.projects.filter((p) => p.id !== id) };
		}),
	isLoadingProjects: false,
	setIsLoadingProjects: (v) => set({ isLoadingProjects: v }),
}));

/** True once the signed-in user's team context has loaded AND a team exists.
 *  Team-scoped fetchers (requireTeamId) throw before that point — gate their
 *  `enabled` on this to avoid the transient post-login error flash. */
export function useTeamReady(): boolean {
	return useAppStore((s) => s.teamLoaded && s.team != null);
}

/** Client mirror of the DB-side team_is_writable() write gate. Optimistic
 *  before team context loads; RLS stays authoritative. Use it to disable
 *  create/edit/delete controls when the trial/subscription has lapsed. */
export function useIsWritable(): boolean {
	const team = useAppStore((s) => s.team);
	return team?.is_writable ?? true;
}
