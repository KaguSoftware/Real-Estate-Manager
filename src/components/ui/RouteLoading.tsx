/**
 * Shared fallback for route-segment loading.tsx files. Every top-level route
 * has a loading.tsx wrapping this so tab switches show immediate feedback
 * (and Next can partially prefetch dynamic routes) instead of freezing on
 * the previous page.
 */
export function RouteLoading({ label = "Yükleniyor" }: { label?: string }) {
	return (
		<main
			className="min-h-[60vh] flex flex-col items-center justify-center gap-3"
			aria-busy="true"
			aria-label={label}
		>
			<span className="h-8 w-8 rounded-full border-[3px] border-base-300 border-t-primary animate-spin" />
			<p className="text-xs font-medium text-base-content/50">{label}…</p>
		</main>
	);
}
