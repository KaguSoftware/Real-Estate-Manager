import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { ContactDashboard } from "@/src/components/contacts/ContactDashboard";

export default async function LeadsPage() {
	// Server-side guard: unauthenticated visitors land on the home page instead
	// of an empty client-rendered shell. Data itself remains RLS-protected.
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) redirect("/");

	// ContactDashboard reads ?new= via useSearchParams, which requires a Suspense
	// boundary so the route can still be prerendered.
	return (
		<Suspense fallback={null}>
			<ContactDashboard />
		</Suspense>
	);
}
