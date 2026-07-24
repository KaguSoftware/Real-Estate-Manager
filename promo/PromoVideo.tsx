/**
 * Main timeline. 30s @ 30fps = 900 frames.
 *
 *   ACT 1  chaos       0–300     (0:00–0:10)
 *   WIPE   transition  300–360   (0:10–0:12)
 *   ACT 2  organize    360–480   (0:12–0:16)
 *          lead        480–630   (0:16–0:21)
 *          document    630–750   (0:21–0:25)
 *   OUTRO             750–900    (0:25–0:30)
 *
 * The wipe overlaps the act boundary: the panel physically covers the frame at
 * its midpoint (~frame 323), which is where the cut underneath it happens.
 */

import React from "react";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Chaos } from "./scenes/Chaos";
import { Wipe } from "./scenes/Wipe";
import { SceneOrganize } from "./scenes/SceneOrganize";
import { SceneLead } from "./scenes/SceneLead";
import { SceneDocument } from "./scenes/SceneDocument";
import { Outro } from "./scenes/Outro";
import { Narration } from "./Narration";
import { light, POP } from "./theme";

export const FPS = 30;
export const DURATION = 900;

const CUT = 323;

/**
 * Wraps a scene so it bounces out of frame near the end of its slot — the
 * "clear the UI out with a bounce" beat, applied between every Act 2 scene.
 */
const BounceOut: React.FC<{ children: React.ReactNode; at: number }> = ({ children, at }) => {
	const frame = useCurrentFrame();
	const { fps, height } = useVideoConfig();
	const out = spring({ frame: frame - at, fps, config: POP });

	return (
		<AbsoluteFill
			style={{
				// Exit scales with frame height so the scene fully clears a
				// 1920px-tall vertical frame, not just a 1080px one.
				transform: `translateY(${interpolate(out, [0, 1], [0, -height * 1.16])}px) scale(${
					interpolate(out, [0, 1], [1, 0.86])
				})`,
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

export const PromoVideo: React.FC = () => (
	<AbsoluteFill style={{ background: light.base200 }}>
		{/* Silent until a VO file exists in promo/audio — see Narration.tsx. */}
		<Narration />

		{/* ACT 1 — runs under the wipe until the cut. */}
		<Sequence durationInFrames={CUT}>
			<Chaos />
		</Sequence>

		{/* ACT 2 — mounted from the cut, revealed as the wipe passes. */}
		<Sequence from={CUT} durationInFrames={750 - CUT}>
			<Sequence durationInFrames={480 - CUT} layout="none">
				<BounceOut at={480 - CUT - 14}>
					<SceneOrganize />
				</BounceOut>
			</Sequence>

			<Sequence from={480 - CUT} durationInFrames={150} layout="none">
				<BounceOut at={136}>
					<SceneLead />
				</BounceOut>
			</Sequence>

			<Sequence from={630 - CUT} durationInFrames={120} layout="none">
				<BounceOut at={106}>
					<SceneDocument />
				</BounceOut>
			</Sequence>
		</Sequence>

		{/* The wipe sits above both acts and hides the cut. */}
		<Sequence from={300} durationInFrames={60}>
			<Wipe />
		</Sequence>

		<Sequence from={750} durationInFrames={150}>
			<Outro />
		</Sequence>
	</AbsoluteFill>
);
