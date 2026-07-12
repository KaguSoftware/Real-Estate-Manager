"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { resolveAndParseMapsUrl } from "@/src/lib/maps-url";
import type { ReverseAddress } from "@/src/lib/geocode";
import { Badge, Input } from "@/src/components/ui";
import { MapPin, MapPinOff, X, Loader2 } from "lucide-react";
import type { LatLon } from "./LocationPickerInner";

export type { LatLon };

const LocationPickerInner = dynamic(
	() => import("./LocationPickerInner").then((m) => m.LocationPickerInner),
	{
		ssr: false,
		loading: () => <div className="h-56 sm:h-64 w-full rounded-2xl bg-base-200 animate-pulse" />,
	},
);

// Losing the picker to a Leaflet init hiccup shouldn't take the whole form down.
class PickerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError() { return { failed: true }; }
	componentDidCatch(err: unknown) {
		console.error("LocationPicker crashed:", err);
	}
	render() {
		if (this.state.failed) {
			return (
				<div className="h-56 sm:h-64 w-full rounded-2xl bg-base-200 border border-base-300 flex flex-col items-center justify-center text-center px-6">
					<MapPinOff className="w-6 h-6 text-base-content/50 mb-2" />
					<p className="text-sm font-semibold text-base-content/80">Harita kullanılamıyor</p>
					<p className="text-xs text-base-content/60 mt-1">Yine de kaydedebilirsiniz — bir harita bağlantısı yapıştırın veya konumu sonra ekleyin.</p>
				</div>
			);
		}
		return this.props.children;
	}
}

/** Fetch the structured address for a pin via the server geocode route. */
async function reverseLookup(coords: LatLon): Promise<ReverseAddress | null> {
	try {
		const res = await fetch(`/api/geocode?lat=${coords.lat}&lon=${coords.lon}`);
		if (!res.ok) return null;
		const body = (await res.json()) as { address: ReverseAddress | null };
		return body.address ?? null;
	} catch {
		return null;
	}
}

interface Props {
	value: LatLon | null;
	/**
	 * Fired whenever the pin changes. `address` carries reverse-geocoded parts
	 * (when available) so the caller can suggest address fields; null coords
	 * mean the pin was cleared.
	 */
	onChange: (coords: LatLon | null, address?: ReverseAddress | null) => void;
	readOnly?: boolean;
	heightClass?: string;
}

type Status =
	| { kind: "idle" }
	| { kind: "resolving" }
	| { kind: "pinned"; filled?: boolean }
	| { kind: "failed"; message: string };

/**
 * Location picker: paste a Google Maps link OR tap/drag the pin on the map.
 * Every pin change reverse-geocodes (server-side, rate-limited) and hands the
 * address parts to the parent for autofill.
 */
export function LocationPicker({ value, onChange, readOnly, heightClass }: Props) {
	const [link, setLink] = useState("");
	const [status, setStatus] = useState<Status>(value ? { kind: "pinned" } : { kind: "idle" });
	const debounceTimer = useRef<number | undefined>(undefined);
	// Monotonic token so a slow parse can't clobber a newer pin.
	const requestSeq = useRef(0);

	// Keep the chip in sync when the parent changes the pin (e.g. eager
	// geocode-on-save drops a pin from outside).
	useEffect(() => {
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled) return;
			setStatus((s) => {
				if (value && s.kind !== "pinned" && s.kind !== "resolving") return { kind: "pinned" };
				if (!value && s.kind === "pinned") return { kind: "idle" };
				return s;
			});
		});
		return () => { cancelled = true; };
	}, [value]);

	const parseLink = useCallback(async (raw: string) => {
		const url = raw.trim();
		if (!url) return;
		const seq = ++requestSeq.current;
		setStatus({ kind: "resolving" });
		const result = await resolveAndParseMapsUrl(url);
		if (seq !== requestSeq.current) return; // superseded
		if (result.lat != null && result.lon != null) {
			onChange({ lat: result.lat, lon: result.lon }, result.address ?? null);
			setStatus({ kind: "pinned", filled: !!result.address });
		} else {
			setStatus({
				kind: "failed",
				message: result.error ?? "Bu bağlantı okunamadı — konumu işaretlemek için haritaya dokunun.",
			});
		}
	}, [onChange]);

	function onLinkChange(raw: string) {
		setLink(raw);
		window.clearTimeout(debounceTimer.current);
		if (!raw.trim()) {
			setStatus(value ? { kind: "pinned" } : { kind: "idle" });
			return;
		}
		debounceTimer.current = window.setTimeout(() => { void parseLink(raw); }, 600);
	}

	async function handlePick(coords: LatLon) {
		const seq = ++requestSeq.current;
		onChange(coords); // pin lands immediately…
		setStatus({ kind: "resolving" });
		const address = await reverseLookup(coords); // …address suggestions follow
		if (seq !== requestSeq.current) return;
		if (address) onChange(coords, address);
		setStatus({ kind: "pinned", filled: !!address });
	}

	function clearPin() {
		requestSeq.current++;
		onChange(null);
		setLink("");
		setStatus({ kind: "idle" });
	}

	if (readOnly) {
		return (
			<PickerErrorBoundary>
				<div translate="no" className="notranslate">
					<LocationPickerInner value={value} readOnly heightClass={heightClass} />
				</div>
			</PickerErrorBoundary>
		);
	}

	// translate="no": Google Translate replaces text nodes in place, which makes
	// React's removeChild blow up on the conditionally rendered status labels
	// and Leaflet's DOM. Exempt the whole picker from page translation.
	return (
		<div className="space-y-2.5 notranslate" translate="no">
			<div className="flex flex-col sm:flex-row sm:items-center gap-2">
				<Input
					type="url"
					value={link}
					onChange={(e) => onLinkChange(e.target.value)}
					placeholder="Google Haritalar bağlantısı yapıştırın (isteğe bağlı)…"
					aria-label="Google Haritalar bağlantısı"
					className="flex-1"
				/>
				<StatusChip status={status} pinned={!!value} onClear={clearPin} onRetry={() => void parseLink(link)} />
			</div>

			<PickerErrorBoundary>
				<LocationPickerInner value={value} onPick={handlePick} heightClass={heightClass} />
			</PickerErrorBoundary>

			<p className="text-xs text-base-content/50">
				Tam konumu belirlemek için haritaya dokunun veya iğneyi sürükleyin — yakındaki adres alanları otomatik doldurulur.
			</p>
		</div>
	);
}

function StatusChip({
	status,
	pinned,
	onClear,
	onRetry,
}: {
	status: Status;
	pinned: boolean;
	onClear: () => void;
	onRetry: () => void;
}) {
	if (status.kind === "resolving") {
		return (
			<Badge tone="slate" className="shrink-0 self-start sm:self-auto">
				<Loader2 className="w-3.5 h-3.5 animate-spin" />
				Çözümleniyor…
			</Badge>
		);
	}
	if (pinned) {
		return (
			<Badge tone="emerald" className="shrink-0 self-start sm:self-auto">
				<MapPin className="w-3.5 h-3.5" />
				İşaretlendi
				<button
					type="button"
					onClick={onClear}
					aria-label="Konumu temizle"
					className="-mr-0.5 ml-0.5 rounded-full hover:bg-success/20 p-0.5 transition-colors"
				>
					<X className="w-3 h-3" />
				</button>
			</Badge>
		);
	}
	if (status.kind === "failed") {
		return (
			<span className="shrink-0 self-start sm:self-auto inline-flex items-center gap-2 text-xs text-warning">
				<Badge tone="amber">
					<MapPinOff className="w-3.5 h-3.5" />
					Bağlantı okunamadı
				</Badge>
				<button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
					Tekrar dene
				</button>
			</span>
		);
	}
	return (
		<Badge tone="slate" className="shrink-0 self-start sm:self-auto">
			<MapPinOff className="w-3.5 h-3.5" />
			İşaretlenmedi
		</Badge>
	);
}
