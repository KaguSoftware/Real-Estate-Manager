/**
 * THE TRANSITION (0:10–0:12)
 *
 * A hard-edged primary-colored panel sweeps across and takes the clutter with
 * it. Uses the WIPE config (heavily damped): a wipe that oscillates reads as a
 * rendering bug rather than a cartoon flourish.
 */

import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { light, font, WIPE } from "../theme";
import { useFormat } from "../format";

export const Wipe: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps, width } = useVideoConfig();
	const f = useFormat();

	const sweep = spring({ frame, fps, config: WIPE, durationInFrames: 46 });

	// Panel travels left→right across the full width plus its own skew overhang.
	const x = interpolate(sweep, [0, 1], [-width - 400, width + 400]);

	// The leading edge is angled; a straight edge looks like a slide, not a wipe.
	const skew = -12;

	return (
		<AbsoluteFill style={{ pointerEvents: "none" }}>
			<div
				style={{
					position: "absolute",
					top: -80,
					bottom: -80,
					left: 0,
					width: width + 500,
					transform: `translateX(${x}px) skewX(${skew}deg)`,
					background: light.primary,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						transform: `skewX(${-skew}deg)`,
						font: `900 ${f.v(62, 96)}px/1 ${font.sans}`,
						letterSpacing: "-0.03em",
						color: light.primaryContent,
						opacity: interpolate(sweep, [0.28, 0.5, 0.72], [0, 1, 0], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
						whiteSpace: "nowrap",
					}}
				>
					There&apos;s a better way.
				</div>
			</div>

			{/* Trailing speed lines */}
			{[0.16, 0.34, 0.52, 0.7].map((o, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						top: `${14 + i * 22}%`,
						left: 0,
						height: 7,
						width: 260,
						background: light.accent,
						borderRadius: 999,
						transform: `translateX(${x - 420 - i * 130}px)`,
						opacity: interpolate(sweep, [0, 0.2, 0.85, 1], [0, o, o, 0]),
					}}
				/>
			))}
		</AbsoluteFill>
	);
};
