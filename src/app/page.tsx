"use client";

import { Suspense } from "react";
import { PropertyDashboard } from "@/src/components/properties/PropertyDashboard";

export default function HomePage() {
	// PropertyDashboard reads filter params via useSearchParams, which requires
	// a Suspense boundary so the route can still be prerendered.
	return (
		<Suspense fallback={null}>
			<PropertyDashboard />
		</Suspense>
	);
}
