import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { PropertyForm } from "@/src/components/properties/PropertyForm";

export default async function NewPropertyPage() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");

	return (
		<div className="min-h-screen bg-slate-50">
			<header className="bg-white border-b border-slate-200">
				<div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
					<div>
						<h1 className="text-lg font-bold text-slate-900">Add a property</h1>
						<p className="text-xs text-slate-500">Create a new listing in your portfolio.</p>
					</div>
					<Link href="/" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
						← Back to dashboard
					</Link>
				</div>
			</header>
			<main className="max-w-3xl mx-auto px-6 py-8">
				<div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8">
					<PropertyForm mode="create" />
				</div>
			</main>
		</div>
	);
}
