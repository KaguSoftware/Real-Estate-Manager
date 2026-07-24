/**
 * THE OUTRO (0:25–0:30)
 *
 * The UI clears out with a bounce and the branding scales up playfully.
 */

import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { light, font, BOUNCE, POP } from "../theme";
import { useFormat } from "../format";

export const Outro: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const f = useFormat();

	const title = spring({ frame: frame - 8, fps, config: BOUNCE });
	const rule = spring({ frame: frame - 26, fps, config: POP });
	const url = spring({ frame: frame - 34, fps, config: BOUNCE });

	// Slow drift keeps the final card from feeling like a freeze-frame.
	const drift = interpolate(frame, [0, 150], [1, 1.045]);

	return (
		<AbsoluteFill
			style={{
				background: light.base100,
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			{/* Concentric rings radiating behind the wordmark */}
			{[0, 1, 2].map((i) => {
				const t = spring({ frame: frame - 6 - i * 5, fps, config: { damping: 200, mass: 1, stiffness: 55 } });
				const size = f.v(360, 420) + i * f.v(240, 300);
				return (
					<div
						key={i}
						style={{
							position: "absolute",
							width: size,
							height: size,
							borderRadius: "50%",
							border: `2px solid ${light.primary}`,
							opacity: interpolate(t, [0, 1], [0.22, 0.05]) * (1 - i * 0.22),
							transform: `scale(${interpolate(t, [0, 1], [0.5, 1])})`,
						}}
					/>
				);
			})}

			<div
				style={{
					textAlign: "center",
					transform: `scale(${drift})`,
					zIndex: 2,
					padding: `0 ${f.pad}px`,
				}}
			>
				{/* Domain leads — the thing to remember. Sized to fill the frame
				    width, so it scales with the longest line rather than a fixed px. */}
				<h1
					style={{
						font: `900 ${f.v(62, 104)}px/1.05 ${font.sans}`,
						letterSpacing: "-0.04em",
						color: light.baseContent,
						margin: 0,
						transform: `scale(${title})`,
						whiteSpace: "nowrap",
					}}
				>
					kagu-realestate.com
				</h1>

				<div
					style={{
						height: 5,
						width: f.v(160, 200),
						background: light.accent,
						borderRadius: 999,
						margin: `${f.v(30, 36)}px auto`,
						transform: `scaleX(${rule})`,
					}}
				/>

				<p
					style={{
						font: `700 ${f.v(36, 46)}px/1.25 ${font.sans}`,
						letterSpacing: "-0.02em",
						color: `color-mix(in oklch, ${light.baseContent} 70%, transparent)`,
						margin: 0,
						transform: `scale(${url})`,
					}}
				>
					Real Estate, <span style={{ color: light.primary }}>Simplified.</span>
				</p>
			</div>
		</AbsoluteFill>
	);
};
