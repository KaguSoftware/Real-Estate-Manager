import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { PropertyDetail } from "@/src/components/properties/PropertyDetail";

export default async function PropertyDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");

	const { id } = await params;

	// PropertyDetail renders its own AppShell (top bar + drawer).
	return <PropertyDetail propertyId={id} />;
}
