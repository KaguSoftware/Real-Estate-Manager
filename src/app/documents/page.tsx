import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { DocumentsDashboard } from "@/src/components/documents/DocumentsDashboard";

export default async function DocumentsPage() {
	// Server-side guard: unauthenticated visitors land on the home page instead
	// of an empty client-rendered shell. Data itself remains RLS-protected.
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");

	return <DocumentsDashboard />;
}
