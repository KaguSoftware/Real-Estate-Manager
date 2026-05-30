"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Property } from "@/src/lib/db/types";

interface MappedProperty {
	id: string;
	lat: number;
	lon: number;
	address_line: string;
	homeowner_name: string;
	price: string | null;
	listingLabel: string;
}

// ── Pin geometry (lucide MapPin path) ───────────────────────────────────────
const PIN_SIZE = 30;
const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_SIZE}" height="${PIN_SIZE}" viewBox="0 0 24 24" fill="#0f172a" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35))">
  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
  <circle cx="12" cy="10" r="3" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/>
</svg>`;

// Single pin (1 property at this spot).
const pinIcon = L.divIcon({
	html: PIN_SVG,
	className: "property-pin-icon",
	iconSize: L.point(PIN_SIZE, PIN_SIZE),
	iconAnchor: L.point(PIN_SIZE / 2, PIN_SIZE),
	tooltipAnchor: L.point(0, -PIN_SIZE),
});

// Pin with a small count badge (2+ properties at this spot).
function stackedPinIcon(count: number): L.DivIcon {
	const badge =
		`<div style="` +
		`position:absolute;top:-4px;right:-4px;` +
		`min-width:18px;height:18px;padding:0 4px;` +
		`display:flex;align-items:center;justify-content:center;` +
		`border-radius:9999px;background:#0f172a;color:#fff;` +
		`font-size:10px;font-weight:700;` +
		`border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,0.35);` +
		`pointer-events:none;` +
		`">${count}</div>`;
	return L.divIcon({
		html: `<div style="position:relative;width:${PIN_SIZE}px;height:${PIN_SIZE}px">${PIN_SVG}${badge}</div>`,
		className: "property-pin-icon",
		iconSize: L.point(PIN_SIZE, PIN_SIZE),
		iconAnchor: L.point(PIN_SIZE / 2, PIN_SIZE),
		tooltipAnchor: L.point(0, -PIN_SIZE),
	});
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
	);
}

// ── Grouping ────────────────────────────────────────────────────────────────
// Snap nearby coords into the same "cell" so co-located properties share one
// pin. 5 decimal places ≈ 1.1m at the equator — tight enough that "same
// address" stays together but neighbors stay separate.
function cellKey(lat: number, lon: number): string {
	return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

interface Cell {
	key: string;
	lat: number;
	lon: number;
	items: MappedProperty[];
}

function groupByCell(points: MappedProperty[]): Cell[] {
	const m = new Map<string, Cell>();
	for (const p of points) {
		const key = cellKey(p.lat, p.lon);
		const existing = m.get(key);
		if (existing) {
			existing.items.push(p);
		} else {
			m.set(key, { key, lat: p.lat, lon: p.lon, items: [p] });
		}
	}
	return [...m.values()];
}

// ── FitBounds ───────────────────────────────────────────────────────────────
function FitBounds({ cells }: { cells: Cell[] }) {
	const map = useMap();
	useEffect(() => {
		if (cells.length === 0) return;
		try {
			const bounds = L.latLngBounds(cells.map((c) => [c.lat, c.lon] as [number, number]));
			if (bounds.isValid()) {
				map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
			}
		} catch {
			// Bad coords shouldn't crash the dashboard.
		}
	}, [cells, map]);
	return null;
}

// ── Cell markers ────────────────────────────────────────────────────────────
function CellMarkers({
	cells,
	onClickCell,
}: {
	cells: Cell[];
	// Pass the cluster cell + its current screen pixel (relative to map container).
	onClickCell: (cell: Cell, screenPt: { x: number; y: number }) => void;
}) {
	const map = useMap();

	useEffect(() => {
		const markers: L.Marker[] = [];

		for (const cell of cells) {
			const icon = cell.items.length > 1 ? stackedPinIcon(cell.items.length) : pinIcon;
			const marker = L.marker([cell.lat, cell.lon], { icon });

			// Hover tooltip:
			//   - 1 property: name + address.
			//   - N properties: "N properties — click to choose".
			if (cell.items.length === 1) {
				const p = cell.items[0];
				const meta = [p.listingLabel, p.price].filter(Boolean).join(" · ");
				marker.bindTooltip(
					`<div style="font-size:11px;line-height:1.35">` +
						`<div style="font-weight:600;color:#0f172a">${escapeHtml(p.homeowner_name)}</div>` +
						`<div style="color:#475569;margin-top:2px">${escapeHtml(p.address_line)}</div>` +
						(meta ? `<div style="color:#64748b;margin-top:2px">${escapeHtml(meta)}</div>` : "") +
						`</div>`,
					{ direction: "top", offset: L.point(0, -PIN_SIZE + 4), opacity: 1 },
				);
			} else {
				marker.bindTooltip(
					`<div style="font-size:11px;font-weight:600;color:#0f172a">` +
						`${cell.items.length} properties — click to choose` +
						`</div>`,
					{ direction: "top", offset: L.point(0, -PIN_SIZE + 4), opacity: 1 },
				);
			}

			marker.on("click", () => {
				const screen = map.latLngToContainerPoint([cell.lat, cell.lon]);
				onClickCell(cell, { x: screen.x, y: screen.y });
			});

			marker.addTo(map);
			markers.push(marker);
		}

		return () => {
			for (const m of markers) map.removeLayer(m);
		};
	}, [cells, map, onClickCell]);

	return null;
}

// ── Dismissal hooks ─────────────────────────────────────────────────────────
// Close the wheel on map pan/zoom/click — feels like a native UI.
function MapInteractionWatcher({ onMapChange }: { onMapChange: () => void }) {
	useMapEvents({
		click: onMapChange,
		movestart: onMapChange,
		zoomstart: onMapChange,
	});
	return null;
}

// ── Radial selector ("weapon wheel") ────────────────────────────────────────
function RadialSelector({
	cell,
	screenPt,
	onPick,
	onClose,
}: {
	cell: Cell;
	screenPt: { x: number; y: number };
	onPick: (id: string) => void;
	onClose: () => void;
}) {
	const n = cell.items.length;
	// Radius scales with count so the petals never overlap.
	const radius = Math.min(110, 56 + n * 6);
	const nodeSize = 44;
	const startAngle = -Math.PI / 2; // 12 o'clock

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div
			className="absolute inset-0 pointer-events-none"
			style={{ zIndex: 500 }}
			aria-hidden="false"
		>
			{/* Full-canvas click-catcher dismisses the wheel without blocking
			    the markers themselves (we stopPropagation on the nodes below). */}
			<div
				className="absolute inset-0 pointer-events-auto"
				onClick={onClose}
				style={{ background: "transparent" }}
			/>

			{/* Center ring — purely visual; positioned at the cluster pin. */}
			<div
				className="absolute pointer-events-none"
				style={{
					left: screenPt.x,
					top: screenPt.y - PIN_SIZE / 2,
					width: 0,
					height: 0,
				}}
			>
				<div
					style={{
						position: "absolute",
						left: -radius - nodeSize / 2,
						top: -radius - nodeSize / 2,
						width: (radius + nodeSize / 2) * 2,
						height: (radius + nodeSize / 2) * 2,
						borderRadius: "9999px",
						border: "1px dashed rgba(15, 23, 42, 0.25)",
						background: "rgba(255, 255, 255, 0.55)",
						backdropFilter: "blur(2px)",
						WebkitBackdropFilter: "blur(2px)",
						boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
						animation: "wheelIn 160ms ease-out",
					}}
				/>
			</div>

			{/* Petals — each property becomes a circular node on the ring. */}
			{cell.items.map((p, i) => {
				const angle = startAngle + (2 * Math.PI * i) / n;
				const dx = Math.cos(angle) * radius;
				const dy = Math.sin(angle) * radius;
				const centerX = screenPt.x;
				const centerY = screenPt.y - PIN_SIZE / 2;
				const nodeLeft = centerX + dx - nodeSize / 2;
				const nodeTop = centerY + dy - nodeSize / 2;

				return (
					<button
						key={p.id}
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onPick(p.id);
						}}
						className="absolute pointer-events-auto group"
						style={{
							left: nodeLeft,
							top: nodeTop,
							width: nodeSize,
							height: nodeSize,
							borderRadius: "9999px",
							background: "#0f172a",
							color: "#fff",
							border: "2px solid #fff",
							boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
							fontSize: 13,
							fontWeight: 700,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							cursor: "pointer",
							transition: "transform 120ms ease-out, background 120ms ease-out",
							animation: `petalIn 200ms ease-out ${i * 20}ms both`,
						}}
						title={`${p.homeowner_name} — ${p.address_line}`}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)";
							(e.currentTarget as HTMLButtonElement).style.background = "#1e293b";
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
							(e.currentTarget as HTMLButtonElement).style.background = "#0f172a";
						}}
					>
						{i + 1}
					</button>
				);
			})}

			{/* Inline keyframes — scoped to this component. */}
			<style>{`
				@keyframes wheelIn {
					from { opacity: 0; transform: scale(0.6); }
					to   { opacity: 1; transform: scale(1); }
				}
				@keyframes petalIn {
					from { opacity: 0; transform: scale(0.2); }
					to   { opacity: 1; transform: scale(1); }
				}
			`}</style>
		</div>
	);
}

// ── Top-level component ─────────────────────────────────────────────────────
export function PropertyMapInner({ properties }: { properties: Property[] }) {
	const router = useRouter();
	const containerRef = useRef<HTMLDivElement | null>(null);

	const points = useMemo<MappedProperty[]>(
		() =>
			properties
				.map((p) => ({
					id: p.id,
					lat: Number(p.latitude),
					lon: Number(p.longitude),
					address_line: p.address_line,
					homeowner_name: p.homeowner_name,
					price: p.list_price != null ? `${p.list_price.toLocaleString()} ${p.currency}` : null,
					listingLabel: p.listing_type === "for_rent" ? "For Rent" : "For Sale",
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

	const cells = useMemo(() => groupByCell(points), [points]);

	const [openWheel, setOpenWheel] = useState<{
		cell: Cell;
		screenPt: { x: number; y: number };
	} | null>(null);

	const onClickCell = useCallback(
		(cell: Cell, screenPt: { x: number; y: number }) => {
			if (cell.items.length === 1) {
				router.push(`/properties/${cell.items[0].id}`);
				return;
			}
			setOpenWheel({ cell, screenPt });
		},
		[router],
	);

	const closeWheel = useCallback(() => setOpenWheel(null), []);
	const pickFromWheel = useCallback(
		(id: string) => {
			setOpenWheel(null);
			router.push(`/properties/${id}`);
		},
		[router],
	);

	// Stable view config — keeps re-renders from snapping the camera back.
	const initialCenterRef = useRef<[number, number]>(
		points.length > 0 ? [points[0].lat, points[0].lon] : [41.015, 28.979], // İstanbul
	);
	const initialZoomRef = useRef<number>(points.length > 0 ? 11 : 6);

	// Defer mount by one tick so React 19 StrictMode double-invoke in dev
	// commits the DOM before Leaflet binds.
	const [mounted, setMounted] = useState(false);
	useEffect(() => { setMounted(true); }, []);
	if (!mounted) {
		return <div className="h-56 sm:h-80 w-full rounded-2xl bg-slate-100 animate-pulse" />;
	}

	return (
		<div ref={containerRef} className="relative h-56 sm:h-80 w-full">
			<MapContainer
				center={initialCenterRef.current}
				zoom={initialZoomRef.current}
				scrollWheelZoom
				className="h-56 sm:h-80 w-full rounded-2xl"
				style={{ zIndex: 0 }}
			>
				{/* CartoDB Positron — light, near-monochrome tiles. No key needed. */}
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
					url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
					subdomains="abcd"
					maxZoom={20}
				/>
				<FitBounds cells={cells} />
				<CellMarkers cells={cells} onClickCell={onClickCell} />
				<MapInteractionWatcher onMapChange={closeWheel} />
			</MapContainer>

			{openWheel && (
				<RadialSelector
					cell={openWheel.cell}
					screenPt={openWheel.screenPt}
					onPick={pickFromWheel}
					onClose={closeWheel}
				/>
			)}
		</div>
	);
}
