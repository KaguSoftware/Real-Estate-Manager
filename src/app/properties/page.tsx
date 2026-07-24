import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { PropertyDashboard } from "@/src/components/properties/PropertyDashboard";

export default async function PropertiesPage() {
	// Server-side guard: unauthenticated visitors land on the home dashboard.
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) redirect("/");

	// PropertyDashboard reads filter params via useSearchParams, which requires
	// a Suspense boundary so the route can still be prerendered.
	return (
		<Suspense fallback={null}>
			<PropertyDashboard />
		</Suspense>
	);
}
