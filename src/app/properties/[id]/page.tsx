import Link from "next/link";
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

	return (
		<div className="min-h-screen bg-slate-50">
			<header className="bg-white border-b border-slate-200 sticky top-0 z-10">
				<div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
					<Link
						href="/"
						className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
					>
						← Back to dashboard
					</Link>
				</div>
			</header>
			<main>
				<PropertyDetail propertyId={id} />
			</main>
		</div>
	);
}
