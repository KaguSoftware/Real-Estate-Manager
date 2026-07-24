/**
 * Format awareness for the promo.
 *
 * The same scenes render at 1920×1080 (landscape) and 1080×1920 (vertical).
 * Rather than scaling a 16:9 layout down — which would leave the dashboard's
 * columns ~200px wide and unreadable on a phone — scenes ask which format they
 * are in and reflow: fewer columns, taller rows, bigger type.
 *
 * Everything here derives from useVideoConfig(), so nothing hardcodes a
 * resolution and a third format would only need new branches.
 */

import { useVideoConfig } from "remotion";

export interface Format {
	/** True at 9:16 — phone/Instagram/TikTok/Shorts. */
	vertical: boolean;
	width: number;
	height: number;
	/** Frame center, for absolutely-positioned elements. */
	cx: number;
	cy: number;
	/** Outer padding — tighter on a narrow frame. */
	pad: number;
	/** Pick a value per format: v(verticalValue, landscapeValue). */
	v: <T>(vertical: T, landscape: T) => T;
}

export const useFormat = (): Format => {
	const { width, height } = useVideoConfig();
	const vertical = height > width;

	return {
		vertical,
		width,
		height,
		cx: width / 2,
		cy: height / 2,
		pad: vertical ? 48 : 70,
		v: <T,>(verticalValue: T, landscapeValue: T): T =>
			vertical ? verticalValue : landscapeValue,
	};
};
