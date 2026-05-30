import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { DocumentWizard } from "@/src/components/documents/DocumentWizard";
import { AppShell } from "@/src/components/ui";

export default async function NewDocumentPage() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");

	return (
		<AppShell title="New document" subtitle="Generate a contract for a property">
			<DocumentWizard />
		</AppShell>
	);
}
