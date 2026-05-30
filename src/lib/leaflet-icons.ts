// Leaflet's default-marker icons are normally resolved relative to the
// leaflet CSS. Under Next.js + Turbopack, the bundler-imported PNGs were
// resolving to objects without a usable `.src`, leaving Leaflet with
// `iconUrl: undefined` and throwing "iconUrl not set in Icon options" on
// the first marker render.
//
// Fix: serve the marker PNGs from /public/leaflet/ and reference them by
// absolute path. The files live alongside this codebase — see
// public/leaflet/marker-icon{,-2x,-shadow}.png.

import L from "leaflet";

let patched = false;

export function ensureLeafletIcons(): void {
	if (patched) return;
	patched = true;

	delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

	L.Icon.Default.mergeOptions({
		iconUrl: "/leaflet/marker-icon.png",
		iconRetinaUrl: "/leaflet/marker-icon-2x.png",
		shadowUrl: "/leaflet/marker-shadow.png",
	});
}
