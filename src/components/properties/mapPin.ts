// Shared Leaflet pin icon (lucide MapPin path) used by the dashboard map and
// the LocationPicker. Client-only — imports Leaflet.

import L from "leaflet";

export const PIN_SIZE = 30;

// Theme-driven colors (daisyUI vars) so the pin stays visible in dark mode
// instead of the old hardcoded near-black fill.
export const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_SIZE}" height="${PIN_SIZE}" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="fill:var(--color-base-content,#0f172a);stroke:var(--color-base-100,#ffffff);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35))">
  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
  <circle cx="12" cy="10" r="3" style="fill:var(--color-base-100,#ffffff);stroke:var(--color-base-content,#0f172a)" stroke-width="1.5"/>
</svg>`;

/** Single pin (1 property / picker pin). */
export const pinIcon = L.divIcon({
	html: PIN_SVG,
	className: "property-pin-icon",
	iconSize: L.point(PIN_SIZE, PIN_SIZE),
	iconAnchor: L.point(PIN_SIZE / 2, PIN_SIZE),
	tooltipAnchor: L.point(0, -PIN_SIZE),
});

/** Pin with a small count badge (2+ properties at the same spot). */
export function stackedPinIcon(count: number): L.DivIcon {
	const badge =
		`<div style="` +
		`position:absolute;top:-4px;right:-4px;` +
		`min-width:18px;height:18px;padding:0 4px;` +
		`display:flex;align-items:center;justify-content:center;` +
		`border-radius:9999px;background:var(--color-base-content,#0f172a);color:var(--color-base-100,#fff);` +
		`font-size:10px;font-weight:700;` +
		`border:2px solid var(--color-base-100,#fff);box-shadow:0 1px 2px rgba(0,0,0,0.35);` +
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
