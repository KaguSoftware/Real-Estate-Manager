"use client";

import { Component, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/src/store";
import { MapPin, MapPinOff, Maximize2, Minimize2 } from "lucide-react";

// Defensive boundary: if Leaflet throws (e.g. StrictMode double-mount, bad
// coords slipping through, tile-layer init race), we'd rather lose the map
// section than crash the whole dashboard.
class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError() { return { failed: true }; }
	componentDidCatch(err: unknown) {
		console.error("PropertyMap crashed:", err);
	}
	render() {
		if (this.state.failed) {
			return (
				<div className="h-64 sm:h-96 w-full flex items-center justify-center text-center px-6">
					<div className="flex flex-col items-center">
						<MapPinOff className="w-7 h-7 text-base-content/50 mb-2" />
						<p className="text-sm font-semibold text-base-content/80">Harita kullanılamıyor</p>
						<p className="text-xs text-base-content/60 mt-1">
							Yeniden denemek için sayfayı yenileyin. Diğer özellikler çalışmaya devam eder.
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
			<div className="h-64 sm:h-96 w-full rounded-2xl bg-base-200 animate-pulse" />
		),
	},
);

function isValidCoord(n: unknown): boolean {
	const v = typeof n === "string" ? Number(n) : (n as number | null);
	return typeof v === "number" && Number.isFinite(v);
}

export function PropertyMap() {
	const properties = useAppStore((s) => s.properties);
	const [expanded, setExpanded] = useState(false);
	// Memoized so toggling `expanded` (or any parent re-render) reuses the same
	// array reference — otherwise PropertyMapInner rebuilds all Leaflet markers
	// on every render, which is what made the expand feel sluggish.
	const mappable = useMemo(
		() =>
			properties.filter(
				(p) =>
					isValidCoord(p.latitude) &&
					isValidCoord(p.longitude) &&
					Math.abs(Number(p.latitude)) <= 90 &&
					Math.abs(Number(p.longitude)) <= 180,
			),
		[properties],
	);

	return (
		<section className="relative mb-4 bg-base-100 rounded-2xl border border-base-300 shadow-card overflow-hidden">
			{mappable.length === 0 ? (
				<div className="h-64 sm:h-96 w-full flex items-center justify-center text-center px-6">
					<div className="flex flex-col items-center">
						<MapPin className="w-7 h-7 text-base-content/50 mb-2" />
						<p className="text-sm font-semibold text-base-content/80">Haritada gösterilecek taşınmaz yok</p>
						<p className="text-xs text-base-content/60 mt-1">
							Adresler kayıt sırasında konumlandırılır. Haritada görmek için bir taşınmaz ekleyin veya düzenleyin.
						</p>
					</div>
				</div>
			) : (
				<>
					<MapErrorBoundary>
						<PropertyMapInner
							properties={mappable}
							heightClass={expanded ? "h-[70vh]" : "h-64 sm:h-96"}
						/>
					</MapErrorBoundary>
					<button
						type="button"
						onClick={() => setExpanded((e) => !e)}
						aria-label={expanded ? "Haritayı küçült" : "Haritayı büyüt"}
						className="absolute top-3 right-3 z-10 h-10 w-10 inline-flex items-center justify-center rounded-xl bg-base-100/90 backdrop-blur border border-base-300 text-base-content/70 shadow-soft hover:bg-base-100 hover:text-base-content transition-colors"
					>
						{expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
					</button>
				</>
			)}
		</section>
	);
}
