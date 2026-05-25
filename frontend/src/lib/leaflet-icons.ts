// Leaflet's default-marker URLs are relative imports that break under
// bundlers. The canonical fix is to import the PNGs and patch
// L.Icon.Default.prototype._getIconUrl via mergeOptions.

import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

let patched = false;

export function ensureLeafletIcons(): void {
	if (patched) return;
	patched = true;

	// Strip the broken _getIconUrl that ships with leaflet's prototype.
	delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

	L.Icon.Default.mergeOptions({
		iconUrl: (iconUrl as unknown as { src: string }).src,
		iconRetinaUrl: (iconRetinaUrl as unknown as { src: string }).src,
		shadowUrl: (shadowUrl as unknown as { src: string }).src,
	});
}
