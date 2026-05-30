"use client";

import { Suspense } from "react";
import { LeadDashboard } from "@/src/components/leads/LeadDashboard";

export default function LeadsPage() {
	// LeadDashboard reads ?new=1 via useSearchParams, which requires a Suspense
	// boundary so the route can still be prerendered.
	return (
		<Suspense fallback={null}>
			<LeadDashboard />
		</Suspense>
	);
}
