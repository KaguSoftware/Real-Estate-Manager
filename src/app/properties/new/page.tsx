import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { PropertyForm } from "@/src/components/properties/PropertyForm";
import { AppShell, Card } from "@/src/components/ui";

export default async function NewPropertyPage({
	searchParams,
}: {
	searchParams: Promise<{ project?: string }>;
}) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");

	// Arriving from a project's page pre-links the new unit to it.
	const { project } = await searchParams;

	return (
		<AppShell title="Taşınmaz ekle" subtitle="Yeni ilan oluşturun" width="3xl">
			<Card>
				<PropertyForm mode="create" defaultProjectId={project ?? null} />
			</Card>
		</AppShell>
	);
}
