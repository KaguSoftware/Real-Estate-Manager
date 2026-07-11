import { createClient } from "@/src/lib/supabase/server";
import { HomeDashboard } from "@/src/components/dashboard/HomeDashboard";
import { LandingPage } from "@/src/components/marketing/LandingPage";

/**
 * "/" is two products: the public marketing page for visitors, the dashboard
 * for signed-in users. Decided server-side so visitors get a fully
 * server-rendered, indexable landing page (metadata/SEO live in the layout).
 */
export default async function HomePage() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return <LandingPage />;
	return <HomeDashboard />;
}
