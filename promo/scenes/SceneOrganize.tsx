/**
 * ACT 2 / SCENE A — ORGANIZATION FIX (0:12–0:16)
 *
 * A dashboard lookalike: stat tiles pop in, then property rows fly in from
 * alternating sides and snap into perfect alignment, staggered down the list.
 */

import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { light, font, radius } from "../theme";
import { Card, CardLabel, Badge } from "../components/ui";
import { properties, stats } from "../mockData";
import { SNAP, POP } from "../theme";
import { useFormat } from "../format";

export const SceneOrganize: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const f = useFormat();

	const shell = spring({ frame, fps, config: SNAP });

	// Vertical can't fit five rows plus a 2×2 stat grid; the last two would sit
	// under the fold. Fewer rows also keeps each one big enough to read on a phone.
	const rows = properties.slice(0, f.v(4, properties.length));

	return (
		<AbsoluteFill
			style={{
				background: light.base200,
				padding: f.pad,
				justifyContent: f.v("center", "flex-start"),
				opacity: interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" }),
			}}
		>
			<div style={{ transform: `translateY(${interpolate(shell, [0, 1], [40, 0])}px)` }}>
				<h1
					style={{
						font: `800 ${f.v(58, 46)}px/1.1 ${font.sans}`,
						letterSpacing: "-0.02em",
						color: light.baseContent,
						margin: 0,
					}}
				>
					Genel bakış
				</h1>
				<p
					style={{
						font: `400 ${f.v(26, 20)}px/1.4 ${font.sans}`,
						color: `color-mix(in oklch, ${light.baseContent} 60%, transparent)`,
						margin: "8px 0 0",
					}}
				>
					Her şey bir bakışta
				</p>
			</div>

			{/* Stat tiles — one row at 16:9, a 2×2 grid on a narrow frame. */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: `repeat(${f.v(2, 4)}, 1fr)`,
					gap: f.v(14, 18),
					marginTop: f.v(30, 34),
				}}
			>
				{stats.map((s, i) => {
					const t = spring({ frame: frame - 6 - i * 3, fps, config: POP });
					return (
						<Card
							key={s.label}
							style={{
								padding: f.v("18px 20px", "20px 24px"),
								transform: `scale(${t})`,
								opacity: t,
							}}
						>
							<CardLabel>{s.label}</CardLabel>
							<p
								style={{
									font: `700 ${f.v(42, 38)}px/1.1 ${font.mono}`,
									color: light.baseContent,
									margin: "10px 0 0",
									fontVariantNumeric: "tabular-nums",
								}}
							>
								{s.value}
							</p>
						</Card>
					);
				})}
			</div>

			{/* Property rows snapping into alignment */}
			<Card style={{ marginTop: f.v(22, 26), padding: 10, overflow: "hidden" }}>
				{rows.map((p, i) => {
					const delay = 20 + i * 5;
					const t = spring({ frame: frame - delay, fps, config: SNAP });
					// Alternating sides so the list assembles from both directions.
					// Travel scales with frame width so rows start fully offscreen.
					const fromX = (i % 2 === 0 ? -1 : 1) * f.width;
					const x = interpolate(t, [0, 1], [fromX, 0]);

					return (
						<div
							key={p.title}
							style={{
								display: "flex",
								alignItems: "center",
								gap: f.v(14, 20),
								padding: f.v("15px 16px", "17px 20px"),
								borderBottom:
									i < rows.length - 1 ? `1px solid ${light.base300}` : "none",
								transform: `translateX(${x}px)`,
								opacity: interpolate(t, [0, 0.25], [0, 1], { extrapolateRight: "clamp" }),
							}}
						>
							<div
								style={{
									width: f.v(46, 42),
									height: f.v(46, 42),
									borderRadius: radius.selector,
									background: `color-mix(in oklch, ${light.primary} 14%, transparent)`,
									flexShrink: 0,
								}}
							/>
							<div style={{ flex: 1, minWidth: 0 }}>
								<p
									style={{
										font: `600 ${f.v(22, 19)}px/1.3 ${font.sans}`,
										color: light.baseContent,
										margin: 0,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{p.title}
								</p>
								{/* Vertical has no room for a price column, so the price
								    rides beneath the title next to the location. */}
								<p
									style={{
										font: `400 ${f.v(17, 15)}px/1.3 ${font.sans}`,
										color: `color-mix(in oklch, ${light.baseContent} 55%, transparent)`,
										margin: "3px 0 0",
									}}
								>
									{p.location}
									{f.vertical ? ` · ${p.price}` : ""}
								</p>
							</div>
							{!f.vertical && (
								<span
									style={{
										font: `600 19px/1 ${font.mono}`,
										color: light.baseContent,
										fontVariantNumeric: "tabular-nums",
									}}
								>
									{p.price}
								</span>
							)}
							<div
								style={{
									width: f.v<string | number>("auto", 96),
									display: "flex",
									justifyContent: "flex-end",
									flexShrink: 0,
								}}
							>
								<Badge tone={p.tone}>{p.status}</Badge>
							</div>
						</div>
					);
				})}
			</Card>
		</AbsoluteFill>
	);
};
