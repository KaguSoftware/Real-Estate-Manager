import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { DocumentWizard } from "@/src/components/documents/DocumentWizard";
import { AppShell } from "@/src/components/ui";

export default async function NewDocumentPage() {
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) redirect("/");

	return (
		<AppShell title="Yeni belge" subtitle="Bir taşınmaz için sözleşme oluşturun" width="5xl">
			<DocumentWizard />
		</AppShell>
	);
}
