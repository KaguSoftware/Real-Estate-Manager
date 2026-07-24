/**
 * Remotion root. Registers the promo composition and loads the app's real
 * typefaces (Schibsted Grotesk + IBM Plex Mono, same as src/app/layout.tsx).
 *
 * loadFont() is called at module scope so the faces are registered before the
 * first frame renders — a font that arrives late produces a flash of fallback
 * text baked into the output file.
 */

import React from "react";
import { Composition } from "remotion";
import { loadFont as loadSans } from "@remotion/google-fonts/SchibstedGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { PromoVideo, FPS, DURATION } from "./PromoVideo";

// loadFont(style, options) — the first arg is the style name, and the weights
// are narrowed to the ones actually used below (the default loads all 20+,
// which is dozens of network requests per render).
loadSans("normal", {
	weights: ["400", "500", "600", "700", "800", "900"],
	subsets: ["latin", "latin-ext"],
});
loadMono("normal", {
	weights: ["400", "500", "600", "700"],
	subsets: ["latin", "latin-ext"],
});

/**
 * Two formats from one timeline. The scenes read the frame size via useFormat()
 * and reflow — vertical is not a scaled-down 16:9, it drops the dashboard's
 * price column, stacks the stat tiles 2×2 and shows three pipeline stages
 * instead of five (five would be ~200px wide and unreadable on a phone).
 */
export const RemotionRoot: React.FC = () => (
	<>
		{/* 16:9 — YouTube, site embeds, presentations. */}
		<Composition
			id="Promo"
			component={PromoVideo}
			durationInFrames={DURATION}
			fps={FPS}
			width={1920}
			height={1080}
		/>

		{/* 9:16 — Instagram Reels/Stories, TikTok, YouTube Shorts. */}
		<Composition
			id="PromoVertical"
			component={PromoVideo}
			durationInFrames={DURATION}
			fps={FPS}
			width={1080}
			height={1920}
		/>
	</>
);
