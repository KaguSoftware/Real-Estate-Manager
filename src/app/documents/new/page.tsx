import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { DocumentWizard } from "@/src/components/documents/DocumentWizard";
import { AppShell } from "@/src/components/ui";

export default async function NewDocumentPage() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");

	return (
		<AppShell title="Yeni belge" subtitle="Bir taşınmaz için sözleşme oluşturun" width="3xl">
			<DocumentWizard />
		</AppShell>
	);
}
