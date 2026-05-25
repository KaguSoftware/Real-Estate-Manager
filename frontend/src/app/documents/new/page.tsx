import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { DocumentWizard } from "@/src/components/documents/DocumentWizard";

export default async function NewDocumentPage() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");

	return (
		<div className="min-h-screen bg-slate-50">
			<header className="bg-white border-b border-slate-200">
				<div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
					<div>
						<h1 className="text-lg font-bold text-slate-900">New document</h1>
						<p className="text-xs text-slate-500">Generate a contract tied to one of your properties.</p>
					</div>
					<Link href="/" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
						← Cancel
					</Link>
				</div>
			</header>
			<main>
				<DocumentWizard />
			</main>
		</div>
	);
}
