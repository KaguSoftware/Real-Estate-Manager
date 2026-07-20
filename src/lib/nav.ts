// Single source of truth for app navigation — consumed by the mobile
// NavDrawer and the desktop Sidebar so the two can never drift apart.

import type { ComponentType } from "react";
import { LayoutDashboard, Home, Users, Files, FilePlus2, Shield, UsersRound, CreditCard, UserCog, Building2 } from "lucide-react";

export interface NavItem {
	href: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
	adminOnly?: boolean;
}

export interface NavGroup {
	/** Group heading on desktop; ignored (flattened) in the mobile drawer. */
	label: string | null;
	items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
	{
		label: null,
		items: [{ href: "/", label: "Genel bakış", icon: LayoutDashboard }],
	},
	{
		label: "Çalışma",
		items: [
			{ href: "/properties", label: "Portföy", icon: Home },
			{ href: "/projects", label: "Projeler", icon: Building2 },
			{ href: "/leads", label: "Müşteriler", icon: Users },
			{ href: "/documents", label: "Belgeler", icon: Files },
			{ href: "/documents/new", label: "Yeni belge", icon: FilePlus2 },
		],
	},
	{
		label: "Hesap",
		items: [
			{ href: "/team", label: "Ekip", icon: UsersRound },
			{ href: "/settings/billing", label: "Abonelik", icon: CreditCard },
			{ href: "/settings/profile", label: "Profil", icon: UserCog },
			{ href: "/admin", label: "Yönetim", icon: Shield, adminOnly: true },
		],
	},
];

/** Flat item list (drawer order = group order). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * The single item that should render as active for a pathname: longest
 * matching href wins, so "/documents/new" doesn't also light up "/documents".
 */
export function activeNavHref(pathname: string, items: NavItem[]): string | null {
	const matches = (h: string) => (h === "/" ? pathname === "/" : pathname.startsWith(h));
	const best = items.filter((i) => matches(i.href)).sort((a, b) => b.href.length - a.href.length)[0];
	return best?.href ?? null;
}
