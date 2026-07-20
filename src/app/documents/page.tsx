import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { DocumentsDashboard } from "@/src/components/documents/DocumentsDashboard";

export default async function DocumentsPage() {
	// Server-side guard: unauthenticated visitors land on the home page instead
	// of an empty client-rendered shell. Data itself remains RLS-protected.
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) redirect("/");

	return <DocumentsDashboard />;
}
