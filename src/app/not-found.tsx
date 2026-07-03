import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
	return (
		<main className="min-h-[70vh] flex items-center justify-center px-6">
			<div className="max-w-sm text-center">
				<div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
					<SearchX className="w-6 h-6 text-slate-400" />
				</div>
				<h1 className="text-lg font-bold text-slate-900">Page not found</h1>
				<p className="mt-2 text-sm text-slate-500">
					This page doesn&apos;t exist — it may have been moved or the link is outdated.
				</p>
				<Link
					href="/"
					className="mt-5 inline-flex items-center h-10 px-4 rounded-xl bg-primary text-primary-content text-sm font-semibold hover:brightness-110 transition-all"
				>
					Go to dashboard
				</Link>
			</div>
		</main>
	);
}
