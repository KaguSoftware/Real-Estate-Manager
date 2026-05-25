"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { ensureLeafletIcons } from "@/src/lib/leaflet-icons";
import type { Property } from "@/src/lib/db/types";
import { ArrowRight } from "lucide-react";

ensureLeafletIcons();

interface MappedProperty {
	id: string;
	lat: number;
	lon: number;
	address_line: string;
	homeowner_name: string;
}

function FitBounds({ points }: { points: MappedProperty[] }) {
	const map = useMap();
	useEffect(() => {
		if (points.length === 0) return;
		try {
			const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
			if (bounds.isValid()) {
				map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
			}
		} catch {
			// Bad coords shouldn't crash the whole dashboard. Leave the map at its
			// initial center/zoom.
		}
	}, [points, map]);
	return null;
}

export function PropertyMapInner({ properties }: { properties: Property[] }) {
	const router = useRouter();

	const points = useMemo<MappedProperty[]>(
		() =>
			properties
				.map((p) => ({
					id: p.id,
					lat: Number(p.latitude),
					lon: Number(p.longitude),
					address_line: p.address_line,
					homeowner_name: p.homeowner_name,
				}))
				.filter(
					(p) =>
						Number.isFinite(p.lat) &&
						Number.isFinite(p.lon) &&
						Math.abs(p.lat) <= 90 &&
						Math.abs(p.lon) <= 180,
				),
		[properties],
	);

	// react-leaflet 5 requires a stable container; remember the initial center
	// so re-renders don't reset the view.
	const initialCenterRef = useRef<[number, number]>(
		points.length > 0 ? [points[0].lat, points[0].lon] : [41.015, 28.979], // İstanbul
	);
	const initialZoomRef = useRef<number>(points.length > 0 ? 11 : 6);

	// Defer mount by one tick so React 19's StrictMode double-invoke in dev
	// commits the DOM before Leaflet binds. Prevents "Map container is already
	// initialized" on remount.
	const [mounted, setMounted] = useState(false);
	useEffect(() => { setMounted(true); }, []);
	if (!mounted) {
		return <div className="h-80 w-full rounded-2xl bg-slate-100 animate-pulse" />;
	}

	return (
		<MapContainer
			center={initialCenterRef.current}
			zoom={initialZoomRef.current}
			scrollWheelZoom
			className="h-80 w-full rounded-2xl"
			style={{ zIndex: 0 }}
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
			/>
			<FitBounds points={points} />
			{points.map((p) => (
				<Marker
					key={p.id}
					position={[p.lat, p.lon]}
					eventHandlers={{ click: () => router.push(`/properties/${p.id}`) }}
				>
					<Popup>
						<div className="text-xs">
							<p className="font-semibold text-slate-900">{p.homeowner_name}</p>
							<p className="text-slate-600 mt-0.5">{p.address_line}</p>
							<button
								type="button"
								onClick={() => router.push(`/properties/${p.id}`)}
								className="mt-2 text-primary font-semibold hover:underline inline-flex items-center gap-1"
							>
								Open property
								<ArrowRight className="w-3 h-3" />
							</button>
						</div>
					</Popup>
				</Marker>
			))}
		</MapContainer>
	);
}
