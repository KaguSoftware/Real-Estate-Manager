import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { TenantDashboard } from "@/src/components/tenants/TenantDashboard";

export default async function TenantsPage() {
	// Server-side guard: unauthenticated visitors land on the home page instead
	// of an empty client-rendered shell. Data itself remains RLS-protected.
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");

	// TenantDashboard reads ?new=1 via useSearchParams, which requires a Suspense
	// boundary so the route can still be prerendered.
	return (
		<Suspense fallback={null}>
			<TenantDashboard />
		</Suspense>
	);
}
