"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/src/store";

// Defensive boundary: if Leaflet throws (e.g. StrictMode double-mount, bad
// coords slipping through, tile-layer init race), we'd rather lose the map
// section than crash the whole dashboard.
class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError() { return { failed: true }; }
	componentDidCatch(err: unknown) {
		// eslint-disable-next-line no-console
		console.error("PropertyMap crashed:", err);
	}
	render() {
		if (this.state.failed) {
			return (
				<div className="h-80 w-full flex items-center justify-center text-center px-6">
					<div>
						<p className="text-sm font-semibold text-slate-700">Map unavailable</p>
						<p className="text-xs text-slate-500 mt-1">
							Refresh the page to retry. Other dashboard features still work.
						</p>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

const PropertyMapInner = dynamic(
	() => import("./PropertyMapInner").then((m) => m.PropertyMapInner),
	{
		ssr: false,
		loading: () => (
			<div className="h-80 w-full rounded-2xl bg-slate-100 animate-pulse" />
		),
	},
);

function isValidCoord(n: unknown): boolean {
	const v = typeof n === "string" ? Number(n) : (n as number | null);
	return typeof v === "number" && Number.isFinite(v);
}

export function PropertyMap() {
	const properties = useAppStore((s) => s.properties);
	const mappable = properties.filter(
		(p) =>
			isValidCoord(p.latitude) &&
			isValidCoord(p.longitude) &&
			Math.abs(Number(p.latitude)) <= 90 &&
			Math.abs(Number(p.longitude)) <= 180,
	);

	return (
		<section className="mb-4 bg-white rounded-2xl border border-slate-200 overflow-hidden">
			{mappable.length === 0 ? (
				<div className="h-80 w-full flex items-center justify-center text-center px-6">
					<div>
						<p className="text-sm font-semibold text-slate-700">No mapped properties yet</p>
						<p className="text-xs text-slate-500 mt-1">
							Addresses are geocoded on save. Create or edit a property to see it on the map.
						</p>
					</div>
				</div>
			) : (
				<MapErrorBoundary>
					<PropertyMapInner properties={mappable} />
				</MapErrorBoundary>
			)}
		</section>
	);
}
