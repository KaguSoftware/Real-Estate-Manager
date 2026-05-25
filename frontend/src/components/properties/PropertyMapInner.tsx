"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { ensureLeafletIcons } from "@/src/lib/leaflet-icons";
import type { Property } from "@/src/lib/db/types";

ensureLeafletIcons();

interface MappedProperty {
	id: string;
	lat: number;
	lon: number;
	address_line: string;
	homeowner_name: string;
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
	);
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

// Renders all markers inside a leaflet.markercluster group, which natively
// merges nearby points into numbered cluster bubbles and spider-fies them
// on click (the "flare" effect).
function ClusterLayer({
	points,
	onMarkerClick,
}: {
	points: MappedProperty[];
	onMarkerClick: (id: string) => void;
}) {
	const map = useMap();

	useEffect(() => {
		const cluster = L.markerClusterGroup({
			showCoverageOnHover: false,
			spiderfyOnMaxZoom: true,
			disableClusteringAtZoom: 18,
			maxClusterRadius: 40,
			// Custom minimalist cluster bubble: dark slate fill, white number.
			iconCreateFunction: (c) => {
				const count = c.getChildCount();
				return L.divIcon({
					html:
						`<div style="` +
						`display:flex;align-items:center;justify-content:center;` +
						`width:32px;height:32px;border-radius:9999px;` +
						`background:#0f172a;color:#fff;` +
						`font-size:12px;font-weight:700;` +
						`box-shadow:0 1px 4px rgba(0,0,0,0.25);` +
						`border:2px solid #fff;` +
						`">${count}</div>`,
					className: "property-cluster-icon",
					iconSize: L.point(32, 32),
					iconAnchor: L.point(16, 16),
				});
			},
		});

		for (const p of points) {
			const marker = L.marker([p.lat, p.lon]);

			// Hover tooltip — non-blocking, dismisses when the cursor leaves.
			marker.bindTooltip(
				`<div style="font-size:11px;line-height:1.35">` +
					`<div style="font-weight:600;color:#0f172a">${escapeHtml(p.homeowner_name)}</div>` +
					`<div style="color:#475569;margin-top:2px">${escapeHtml(p.address_line)}</div>` +
					`</div>`,
				{ direction: "top", offset: L.point(0, -28), opacity: 1 },
			);

			marker.on("click", () => onMarkerClick(p.id));
			cluster.addLayer(marker);
		}

		map.addLayer(cluster);

		return () => {
			map.removeLayer(cluster);
		};
	}, [map, points, onMarkerClick]);

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

	// Stable navigation callback — points only re-cluster when properties change.
	const onMarkerClick = useRef((id: string) => router.push(`/properties/${id}`));
	useEffect(() => { onMarkerClick.current = (id) => router.push(`/properties/${id}`); }, [router]);
	const stableOnClick = useMemo(() => (id: string) => onMarkerClick.current(id), []);

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
			{/* CartoDB Positron — light, near-monochrome tiles. Free, no key. */}
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
				url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
				subdomains="abcd"
				maxZoom={20}
			/>
			<FitBounds points={points} />
			<ClusterLayer points={points} onMarkerClick={stableOnClick} />
		</MapContainer>
	);
}
