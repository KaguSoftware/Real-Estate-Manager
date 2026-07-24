/**
 * ACT 2 / SCENE C — PAPERWORK FIX (0:21–0:25)
 *
 * A crumpled stack of paper pops, and a pristine A4 contract sheet springs out
 * of it. Sheet proportions follow the real editor (SHEET_WIDTH_PX 794, A4
 * ratio) from src/components/documents/editor/ContractEditor.tsx, scaled down.
 */

import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { light, font, radius, SNAP, POP, BOUNCE } from "../theme";
import { Badge } from "../components/ui";
import { useFormat } from "../format";

/** Frame the messy stack pops and the clean sheet takes over. */
const MORPH = 34;

/** A4 aspect, mirrored from the real editor's sheet geometry. */
const A4 = 842 / 595;

/**
 * Sheet size per format. Landscape is height-bound (0.72 of the editor's 794px
 * width ≈ 572×809, the tallest that clears the caption); vertical is width-bound,
 * so the sheet is sized from the frame width instead.
 */
const useSheet = (f: ReturnType<typeof useFormat>) => {
	const w = f.vertical ? Math.round(f.width * 0.78) : Math.round(794 * 0.72);
	return { w, h: Math.round(w * A4) };
};

const MessyStack: React.FC<{ w: number }> = ({ w }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	// Loose sheets sized off the clean sheet so the morph reads as one object.
	const pw = Math.round(w * 0.52);
	const ph = Math.round(pw * A4 * 0.94);

	const enter = spring({ frame, fps, config: SNAP });
	const pop = spring({ frame: frame - MORPH, fps, config: POP });
	const gone = frame >= MORPH;

	// Wobble while it sits there — the mess is unstable.
	const wobble = Math.sin(frame / 5) * 2.5;

	return (
		<div
			style={{
				position: "absolute",
				left: "50%",
				// Matches the clean sheet's offset so the morph happens in place.
				top: "calc(50% + 44px)",
				transform: `translate(-50%, -50%) scale(${
					interpolate(enter, [0, 1], [0.3, 1]) * (gone ? 1 + pop * 0.9 : 1)
				}) rotate(${wobble}deg)`,
				opacity: gone ? 1 - pop : 1,
			}}
		>
			{[-9, -4.5, 0, 5, 9.5].map((rot, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: -pw / 2,
						top: -ph / 2,
						width: pw,
						height: ph,
						background: light.base100,
						border: `2px solid ${light.base300}`,
						borderRadius: 6,
						transform: `rotate(${rot}deg) translate(${(i - 2) * 13}px, ${(i - 2) * 7}px)`,
						boxShadow: "0 5px 14px oklch(0% 0 0 / 0.13)",
					}}
				>
					{/* Scrawled, uneven lines — this stack is a mess. */}
					{Array.from({ length: 7 }).map((_, j) => (
						<div
							key={j}
							style={{
								height: 8,
								background: light.base300,
								borderRadius: 4,
								margin: "22px 26px",
								width: `${48 + ((i * 7 + j * 13) % 42)}%`,
								transform: `rotate(${((j % 3) - 1) * 0.9}deg)`,
							}}
						/>
					))}
				</div>
			))}
		</div>
	);
};

const CleanSheet: React.FC<{ w: number; h: number }> = ({ w, h }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	if (frame < MORPH) return null;

	const rise = spring({ frame: frame - MORPH, fps, config: BOUNCE });

	return (
		<div
			style={{
				position: "absolute",
				left: "50%",
				top: "50%",
				width: w,
				height: h,
				marginLeft: -w / 2,
				// Nudged below true center to clear the caption at the top.
				marginTop: -h / 2 + 44,
				transform: `scale(${rise}) rotate(${interpolate(rise, [0, 1], [-14, 0])}deg)`,
				background: light.base100,
				border: `1px solid ${light.base300}`,
				borderRadius: radius.box,
				boxShadow: "0 22px 60px oklch(0% 0 0 / 0.2)",
				padding: 40,
				// Without this the 40px padding sits outside SHEET_W and the
				// full-width content lines spill past the right edge.
				boxSizing: "border-box",
				overflow: "hidden",
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<div>
					<p style={{ font: `700 19px/1.2 ${font.sans}`, color: light.baseContent, margin: 0 }}>
						Kira Sözleşmesi
					</p>
					<p
						style={{
							font: `400 12px/1.3 ${font.mono}`,
							color: `color-mix(in oklch, ${light.baseContent} 50%, transparent)`,
							margin: "4px 0 0",
						}}
					>
						KIR-2026-0142
					</p>
				</div>
				<Badge tone="emerald">Hazır</Badge>
			</div>

			<div style={{ height: 1, background: light.base300, margin: "20px 0" }} />

			{/* Content lines settle in sequence — crisp, aligned, full-width. */}
			{Array.from({ length: 9 }).map((_, i) => {
				const t = spring({ frame: frame - MORPH - 8 - i * 2, fps, config: POP });
				const isHeading = i === 0 || i === 5;
				return (
					<div
						key={i}
						style={{
							height: isHeading ? 11 : 7,
							background: isHeading
								? `color-mix(in oklch, ${light.primary} 55%, transparent)`
								: light.base300,
							borderRadius: 4,
							marginBottom: isHeading ? 16 : 11,
							width: `${isHeading ? 42 : [100, 96, 99, 93][i % 4]}%`,
							transform: `scaleX(${t})`,
							transformOrigin: "left",
							opacity: t,
						}}
					/>
				);
			})}

			{/* Signature block */}
			<div style={{ position: "absolute", left: 40, right: 40, bottom: 40, display: "flex", gap: 26 }}>
				{["Kiralayan", "Kiracı"].map((label, i) => {
					const t = spring({ frame: frame - MORPH - 30 - i * 4, fps, config: POP });
					return (
						<div key={label} style={{ flex: 1, opacity: t, transform: `translateY(${interpolate(t, [0, 1], [16, 0])}px)` }}>
							<div style={{ height: 2, background: light.baseContent, opacity: 0.35 }} />
							<p
								style={{
									font: `500 11px/1.2 ${font.sans}`,
									color: `color-mix(in oklch, ${light.baseContent} 55%, transparent)`,
									margin: "7px 0 0",
								}}
							>
								{label}
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
};

/** Sparkles on the morph — sells the "transformation" beat. */
const Sparkles: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	if (frame < MORPH) return null;

	const t = spring({ frame: frame - MORPH, fps, config: { damping: 200, mass: 0.7, stiffness: 90 } });

	return (
		<>
			{Array.from({ length: 12 }).map((_, i) => {
				const angle = (i / 12) * Math.PI * 2 + 0.3;
				const dist = t * (260 + (i % 4) * 60);
				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: "50%",
							top: "50%",
							width: 14,
							height: 14,
							marginLeft: -7,
							marginTop: -7,
							background: i % 2 ? light.primary : light.accent,
							clipPath:
								"polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)",
							transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(${
								interpolate(t, [0, 0.4, 1], [0, 1.3, 0])
							}) rotate(${t * 180}deg)`,
						}}
					/>
				);
			})}
		</>
	);
};

export const SceneDocument: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const f = useFormat();
	const sheet = useSheet(f);

	const label = spring({ frame: frame - 4, fps, config: POP });

	return (
		<AbsoluteFill style={{ background: light.base200 }}>
			<div
				style={{
					position: "absolute",
					top: f.v(112, 78),
					left: f.pad,
					right: f.pad,
					textAlign: "center",
					font: `800 ${f.v(50, 40)}px/1.2 ${font.sans}`,
					letterSpacing: "-0.02em",
					color: light.baseContent,
					opacity: label,
					transform: `scale(${0.8 + label * 0.2})`,
				}}
			>
				Paperwork, handled.
			</div>

			<MessyStack w={sheet.w} />
			<Sparkles />
			<CleanSheet w={sheet.w} h={sheet.h} />
		</AbsoluteFill>
	);
};
