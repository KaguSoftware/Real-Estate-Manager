import { PaperPileLoader } from "@/src/components/documents/PaperPileLoader";

/** Route-level Suspense fallback for /documents/new — shown while the server
 *  component resolves the auth check before the wizard mounts. */
export default function Loading() {
	return (
		<div className="min-h-screen bg-base-200 flex flex-col items-center justify-center gap-4">
			<PaperPileLoader size="lg" />
			<p className="text-sm font-medium text-base-content/60">Belge oluşturucu hazırlanıyor…</p>
		</div>
	);
}
