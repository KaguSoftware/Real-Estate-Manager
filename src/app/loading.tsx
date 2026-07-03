// Route-transition fallback so slow navigations show feedback instead of a
// frozen previous page.
export default function Loading() {
	return (
		<main className="min-h-[60vh] flex items-center justify-center" aria-busy="true" aria-label="Loading">
			<span className="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-primary animate-spin" />
		</main>
	);
}
