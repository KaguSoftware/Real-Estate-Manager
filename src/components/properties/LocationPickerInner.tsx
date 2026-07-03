"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import type L from "leaflet";
import { pinIcon } from "./mapPin";

export interface LatLon {
	lat: number;
	lon: number;
}

interface Props {
	value: LatLon | null;
	/** Fired when the user drops/drags the pin or taps the map. Absent in readOnly. */
	onPick?: (coords: LatLon) => void;
	readOnly?: boolean;
	/** Tailwind height classes for the map box. */
	heightClass?: string;
}

// İstanbul — sensible fallback center for a Turkish real-estate app.
const DEFAULT_CENTER: [number, number] = [41.015, 28.979];

/** Tap-to-place handler (no-op in readOnly mode). */
function ClickToPlace({ onPick }: { onPick?: (c: LatLon) => void }) {
	useMapEvents({
		click(e) {
			onPick?.({ lat: e.latlng.lat, lon: e.latlng.lng });
		},
	});
	return null;
}

/** Fly to the pin when it changes from outside (e.g. a parsed maps link). */
function FollowPin({ value }: { value: LatLon | null }) {
	const map = useMap();
	useEffect(() => {
		if (!value) return;
		map.flyTo([value.lat, value.lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
	}, [value, map]);
	return null;
}

export function LocationPickerInner({ value, onPick, readOnly, heightClass = "h-56 sm:h-64" }: Props) {
	const markerRef = useRef<L.Marker | null>(null);

	// Stable initial view — captured once so re-renders never snap the camera.
	const [initialView] = useState(() => ({
		center: (value ? [value.lat, value.lon] : DEFAULT_CENTER) as [number, number],
		zoom: value ? 15 : 10,
	}));

	// Defer mount one tick so React StrictMode's dev double-invoke commits the
	// DOM before Leaflet binds (same workaround as PropertyMapInner).
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		let cancelled = false;
		queueMicrotask(() => { if (!cancelled) setMounted(true); });
		return () => { cancelled = true; };
	}, []);
	if (!mounted) {
		return <div className={`${heightClass} w-full rounded-2xl bg-slate-100 animate-pulse`} />;
	}

	return (
		<MapContainer
			center={initialView.center}
			zoom={initialView.zoom}
			scrollWheelZoom={!readOnly}
			dragging={true}
			className={`${heightClass} w-full rounded-2xl`}
			style={{ zIndex: 0 }}
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
				url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
				subdomains="abcd"
				maxZoom={20}
			/>
			{!readOnly && <ClickToPlace onPick={onPick} />}
			<FollowPin value={value} />
			{value && (
				<Marker
					position={[value.lat, value.lon]}
					icon={pinIcon}
					draggable={!readOnly}
					ref={markerRef}
					eventHandlers={
						readOnly
							? undefined
							: {
									dragend() {
										const m = markerRef.current;
										if (!m) return;
										const ll = m.getLatLng();
										onPick?.({ lat: ll.lat, lon: ll.lng });
									},
								}
					}
				/>
			)}
		</MapContainer>
	);
}
