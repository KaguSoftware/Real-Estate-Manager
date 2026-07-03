"use client";

// Route-level error boundary: a crash in any page renders this instead of a
// blank screen, with a way back that doesn't require knowing what happened.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function RouteError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<main className="min-h-[70vh] flex items-center justify-center px-6">
			<div className="max-w-sm text-center">
				<div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center">
					<AlertTriangle className="w-6 h-6 text-red-500" />
				</div>
				<h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
				<p className="mt-2 text-sm text-slate-500">
					The page hit an unexpected error. Your data is safe — try again, or head back
					to the dashboard.
				</p>
				<div className="mt-5 flex items-center justify-center gap-2">
					<button
						type="button"
						onClick={reset}
						className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-content text-sm font-semibold hover:brightness-110 transition-all"
					>
						<RotateCcw className="w-4 h-4" />
						Try again
					</button>
					<Link
						href="/"
						className="inline-flex items-center h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
					>
						Go to dashboard
					</Link>
				</div>
				{error.digest && (
					<p className="mt-4 text-[11px] text-slate-300">Error reference: {error.digest}</p>
				)}
			</div>
		</main>
	);
}
