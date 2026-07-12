"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Property } from "@/src/lib/db/types";
import { PIN_SIZE, pinIcon, stackedPinIcon } from "./mapPin";
import { ChevronRight } from "lucide-react";

interface MappedProperty {
	id: string;
	lat: number;
	lon: number;
	address_line: string;
	homeowner_name: string;
	price: string | null;
	listingLabel: string;
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

// ── Resize watcher ──────────────────────────────────────────────────────────
// Leaflet caches the container size; tell it when the expand toggle changes it.
function InvalidateOnResize({ signal }: { signal: unknown }) {
	const map = useMap();
	useEffect(() => {
		const t = setTimeout(() => map.invalidateSize(), 220); // after the CSS transition
		return () => clearTimeout(t);
	}, [signal, map]);
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
						`${cell.items.length} taşınmaz — seçmek için tıklayın` +
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
// Close the cluster popover on map pan/zoom/click.
function MapInteractionWatcher({ onMapChange }: { onMapChange: () => void }) {
	useMapEvents({
		click: onMapChange,
		movestart: onMapChange,
		zoomstart: onMapChange,
	});
	return null;
}

// ── Cluster popover ─────────────────────────────────────────────────────────
// A small card listing the co-located properties, anchored near the pin.
function ClusterPopover({
	cell,
	screenPt,
	containerSize,
	onPick,
	onClose,
}: {
	cell: Cell;
	screenPt: { x: number; y: number };
	containerSize: { w: number; h: number };
	onPick: (id: string) => void;
	onClose: () => void;
}) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	// Keep the card inside the map box: prefer right of the pin, flip when tight.
	const CARD_W = 264;
	const left = Math.max(8, Math.min(screenPt.x + 14, containerSize.w - CARD_W - 8));
	const top = Math.max(8, Math.min(screenPt.y - PIN_SIZE - 8, containerSize.h - 60));

	return (
		<div className="absolute inset-0" style={{ zIndex: 500 }}>
			{/* Click-catcher dismisses the popover. */}
			<div className="absolute inset-0" onClick={onClose} />

			<div
				role="listbox"
				aria-label={`Bu konumda ${cell.items.length} taşınmaz`}
				className="absolute bg-base-100 rounded-2xl border border-base-300 shadow-pop overflow-hidden animate-[popIn_.14s_ease-out]"
				style={{ left, top, width: CARD_W, maxHeight: Math.min(280, containerSize.h - 16) }}
				onClick={(e) => e.stopPropagation()}
			>
				<p className="px-3.5 pt-3 pb-2 text-sm font-semibold text-base-content/60 border-b border-base-300">
					Burada {cell.items.length} taşınmaz var
				</p>
				<ul className="overflow-y-auto" style={{ maxHeight: 224 }}>
					{cell.items.map((p) => (
						<li key={p.id}>
							<button
								type="button"
								onClick={() => onPick(p.id)}
								className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-base-200 active:bg-base-300 transition-colors"
							>
								<span className="min-w-0 flex-1">
									<span className="block text-sm font-semibold text-base-content truncate">{p.homeowner_name}</span>
									<span className="block text-xs text-base-content/60 truncate">
										{[p.listingLabel, p.price].filter(Boolean).join(" · ")}
									</span>
								</span>
								<ChevronRight className="w-4 h-4 text-base-content/30 shrink-0" />
							</button>
						</li>
					))}
				</ul>
			</div>

			<style>{`@keyframes popIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}`}</style>
		</div>
	);
}

// ── Top-level component ─────────────────────────────────────────────────────
export function PropertyMapInner({
	properties,
	heightClass = "h-64 sm:h-96",
}: {
	properties: Property[];
	heightClass?: string;
}) {
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
					price: p.list_price != null ? `${p.list_price.toLocaleString("tr-TR")} ${p.currency}` : null,
					listingLabel: p.listing_type === "for_rent" ? "Kiralık" : "Satılık",
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

	const [openCluster, setOpenCluster] = useState<{
		cell: Cell;
		screenPt: { x: number; y: number };
	} | null>(null);
	const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

	const onClickCell = useCallback(
		(cell: Cell, screenPt: { x: number; y: number }) => {
			if (cell.items.length === 1) {
				router.push(`/properties/${cell.items[0].id}`);
				return;
			}
			setOpenCluster({ cell, screenPt });
		},
		[router],
	);

	const closeCluster = useCallback(() => setOpenCluster(null), []);
	const pickFromCluster = useCallback(
		(id: string) => {
			setOpenCluster(null);
			router.push(`/properties/${id}`);
		},
		[router],
	);

	// Stable view config captured at first render — re-renders never snap the camera.
	const [initialView] = useState(() => ({
		center: (points.length > 0 ? [points[0].lat, points[0].lon] : [41.015, 28.979]) as [number, number],
		zoom: points.length > 0 ? 11 : 6,
	}));

	// Defer mount by one tick so React 19 StrictMode double-invoke in dev
	// commits the DOM before Leaflet binds.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		let cancelled = false;
		queueMicrotask(() => { if (!cancelled) setMounted(true); });
		return () => { cancelled = true; };
	}, []);
	if (!mounted) {
		return <div className={`${heightClass} w-full rounded-2xl bg-base-200 animate-pulse`} />;
	}

	return (
		<div
			className={`relative ${heightClass} w-full transition-[height] duration-200`}
			ref={(el) => {
				if (el) setContainerSize((s) =>
					s.w === el.clientWidth && s.h === el.clientHeight
						? s
						: { w: el.clientWidth, h: el.clientHeight },
				);
			}}
		>
			<MapContainer
				center={initialView.center}
				zoom={initialView.zoom}
				scrollWheelZoom
				className="h-full w-full rounded-2xl"
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
				<InvalidateOnResize signal={heightClass} />
				<CellMarkers cells={cells} onClickCell={onClickCell} />
				<MapInteractionWatcher onMapChange={closeCluster} />
			</MapContainer>

			{openCluster && (
				<ClusterPopover
					cell={openCluster.cell}
					screenPt={openCluster.screenPt}
					containerSize={containerSize}
					onPick={pickFromCluster}
					onClose={closeCluster}
				/>
			)}
		</div>
	);
}
