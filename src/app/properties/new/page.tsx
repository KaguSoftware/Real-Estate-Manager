import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { PropertyForm } from "@/src/components/properties/PropertyForm";
import { AppShell, Card } from "@/src/components/ui";

export default async function NewPropertyPage() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");

	return (
		<AppShell title="Taşınmaz ekle" subtitle="Yeni ilan oluşturun" width="3xl">
			<Card>
				<PropertyForm mode="create" />
			</Card>
		</AppShell>
	);
}
