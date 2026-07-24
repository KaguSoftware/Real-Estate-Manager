/**
 * ACT 1 — THE CHAOS (0:00–0:10)
 *
 * Stylized text blocks fall like anvils, ring on impact via a low-damping
 * spring, and stack into a messy pile. Squash-and-stretch is derived from the
 * spring's own velocity, so the deformation always lands exactly on the bounce.
 */

import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { dark, font, ANVIL_FALL, ANVIL_REBOUND, ANVIL_REBOUND_FRAMES } from "../theme";
import { useFormat } from "../format";

interface Anvil {
	label: string;
	/** Frame the block starts falling. */
	start: number;
	/** Resting Y (px from top) once stacked. */
	restY: number;
	/** Resting rotation — the pile is messy, nothing lands square. */
	restRot: number;
	x: number;
	width: number;
	height: number;
	fontSize: number;
}

/** Frames after release that the block hits the floor. */
const IMPACT_OFFSET = ANVIL_FALL;

/**
 * Anvil profile: full-width top plate that overhangs a narrower body, which
 * flares slightly into the foot.
 *
 * These blocks are ~5× wider than tall, so the classic deeply-waisted profile
 * is not available — pinching the sides at this aspect ratio reads as torn
 * paper, not iron. Straight angled shoulders under a heavy top plate is the
 * silhouette that survives being this wide.
 */
const ANVIL_SHAPE = `polygon(
	0% 0%, 100% 0%,
	100% 38%, 90% 52%,
	93% 88%, 93% 100%,
	7% 100%, 7% 88%,
	10% 52%, 0% 38%
)`;

/**
 * Y of the floor's top surface. At 9:16 this sits at 74% of the frame height
 * rather than hard against the bottom — the pile then reads in the lower third
 * with the title above it, instead of being jammed off the bottom edge.
 */
const floorFor = (f: ReturnType<typeof useFormat>) =>
	f.vertical ? Math.round(f.height * 0.68) : 880;

/**
 * Block geometry, derived from the frame so the pile works at 16:9 and 9:16.
 *
 * Widths are fractions of frame width (fixed px would overflow the 1080px-wide
 * vertical frame). Height is computed from the type size — text line-height ×
 * 1.1 + padding + borders — because the stack spacing must be at least the real
 * block height or the blocks render on top of each other.
 */
const useAnvils = (f: ReturnType<typeof useFormat>): Anvil[] => {
	const fontSize = f.v(40, 54);
	// Deeper than the text needs: the anvil profile (top plate, shoulders, foot)
	// needs vertical room to read. At text-height the clip just looks like a
	// nicked rectangle. Vertical gets proportionally more depth to hold the
	// ~4:1 width:height ratio that makes the silhouette read as an anvil.
	const padY = f.v(50, 44);
	const blockH = Math.round(fontSize * 1.1 + padY * 2 + 6);
	const gap = 5;

	// Floor sits lower in a tall frame; the pile needs headroom for the title.
	const floorY = floorFor(f);
	const restFor = (i: number) => floorY - blockH - i * (blockH + gap);

	// Drops ~75 frames (2.5s) apart. With ANVIL_FALL=22 the last block releases
	// at 170, lands at 192 and finishes its hop by ~205 — leaving a ~3s beat on
	// the finished pile before the wipe at 300.
	// Width is set by ratio, not by frame fraction. Filling the 1080px-wide
	// vertical frame (0.86–0.92 of it) pushed the blocks to ~8:1 — twice as
	// stretched as landscape's ~4:1 — and the anvil profile flattened into a
	// ribbon. Driving width from the block height keeps the silhouette
	// identical in both formats; only the scale changes.
	const w = (ratio: number) => Math.round(blockH * ratio);

	return [
		{ label: "Scattered Leads", start: 20, restY: restFor(0), restRot: -3.5, x: f.v(-24, -70), width: w(4.1), height: blockH, fontSize },
		{ label: "Lost Contracts", start: 95, restY: restFor(1), restRot: 2.5, x: f.v(22, 60), width: w(3.7), height: blockH, fontSize },
		{ label: "Paperwork Crisis", start: 170, restY: restFor(2), restRot: -1.5, x: f.v(-10, -30), width: w(4.3), height: blockH, fontSize },
	];
};

const FallingBlock: React.FC<{ anvil: Anvil }> = ({ anvil }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const t = frame - anvil.start;
	// Start fully above the frame — one block-height clear of the top edge, so
	// the anvil enters from offscreen rather than popping into view mid-air.
	const START_Y = -anvil.height - 40;
	const fallDist = anvil.restY - START_Y;

	// Accelerating fall, but gentler than true gravity. Real free-fall (t²)
	// crawls at 2px/frame for the first third and then covers 80px/frame at the
	// end — the block is invisible while it dawdles offscreen, then crosses the
	// frame too fast to see. t^1.45 still reads as accelerating under weight
	// while keeping the whole descent legible.
	// Clamped at 0: before the start frame t is negative, and Math.pow() of a
	// negative base with a fractional exponent is NaN — which silently collapses
	// the transform and parks the block on screen early.
	const progress = Math.min(Math.max(t / ANVIL_FALL, 0), 1);
	let y = START_Y + fallDist * Math.pow(progress, 1.45);

	// Exactly one rebound: a half-sine hop after contact, then dead still.
	const sinceImpact = t - ANVIL_FALL;
	const inRebound = sinceImpact >= 0 && sinceImpact < ANVIL_REBOUND_FRAMES;
	if (inRebound) {
		const p = sinceImpact / ANVIL_REBOUND_FRAMES;
		y = anvil.restY - Math.sin(p * Math.PI) * ANVIL_REBOUND;
	}

	// Squash on the two contacts (landing and the rebound's touchdown), then
	// nothing. An anvil is rigid: it deforms on impact, it does not wobble.
	const squashAt = (impactFrame: number, strength: number) => {
		const d = t - impactFrame;
		if (d < 0 || d > 6) return 0;
		return Math.sin((1 - d / 6) * Math.PI) * strength;
	};
	const squash = squashAt(ANVIL_FALL, 0.16) + squashAt(ANVIL_FALL + ANVIL_REBOUND_FRAMES, 0.06);

	const scaleY = 1 - squash;
	// Sideways bulge kept to a third of the vertical squash. A heavy iron block
	// barely widens on impact; matching it 1:1 read as rubber, not metal.
	const scaleX = 1 + squash * 0.33;

	const rot = interpolate(progress, [0, 1], [anvil.restRot * 2.2, anvil.restRot], {
		extrapolateRight: "clamp",
	});

	return (
		<div
			style={{
				position: "absolute",
				left: "50%",
				top: 0,
				// -50% of own width centers the block, so anvil.x is a true
				// offset from frame center rather than from its left edge.
				transform: `translateX(-50%) translateX(${anvil.x}px) translateY(${y}px) rotate(${rot}deg) scale(${scaleX}, ${scaleY})`,
				// Bottom-center: the block squashes down onto whatever it lands
				// on, keeping its base planted instead of sinking through.
				transformOrigin: "50% 100%",
				width: anvil.width,
				height: anvil.height,
				// clipPath crops box-shadow, so the shadow lives on the wrapper
				// as a filter — it follows the clipped silhouette.
				filter: "drop-shadow(0 12px 0 oklch(0% 0 0 / 0.5))",
			}}
		>
			{/* Anvil silhouette: flat top face, waisted body, splayed foot —
			    the classic blacksmith profile, drawn as one clipped block so it
			    squashes as a single rigid object. */}
			<div
				style={{
					width: "100%",
					height: "100%",
					boxSizing: "border-box",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					// Flat iron face with a bright top band — the hammered surface
					// catches light, the body stays solid and heavy.
					background: `linear-gradient(180deg,
						color-mix(in oklch, ${dark.baseContent} 38%, ${dark.base300}) 0%,
						color-mix(in oklch, ${dark.baseContent} 38%, ${dark.base300}) 12%,
						${dark.base300} 12%,
						${dark.base300} 100%)`,
					// Label rides the body, below the top plate.
					paddingTop: 12,
					clipPath: ANVIL_SHAPE,
					padding: "0 44px",
					font: `800 ${anvil.fontSize}px/1.1 ${font.sans}`,
					letterSpacing: "-0.02em",
					color: dark.baseContent,
					textAlign: "center",
					whiteSpace: "nowrap",
				}}
			>
				{anvil.label}
			</div>
		</div>
	);
};

/** Dust puff kicked up when a block lands. */
const Dust: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const t = spring({ frame: frame - at, fps, config: { damping: 200, stiffness: 60, mass: 1 } });
	if (frame < at) return null;

	return (
		<>
			{[-1, 1].map((dir) => (
				<div
					key={dir}
					style={{
						position: "absolute",
						left: "50%",
						top: 0,
						transform: `translateX(-50%) translateX(${x + dir * t * 190}px) translateY(${y + 60}px) scale(${0.5 + t * 1.5})`,
						width: 70,
						height: 70,
						borderRadius: "50%",
						background: `color-mix(in oklch, ${dark.baseContent} 22%, transparent)`,
						opacity: interpolate(t, [0, 0.35, 1], [0, 0.6, 0]),
					}}
				/>
			))}
		</>
	);
};

export const Chaos: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const f = useFormat();
	const anvils = useAnvils(f);
	const floorY = floorFor(f);

	// The whole pile jolts on each impact — sells the weight.
	const shake = anvils.reduce((acc, a) => {
		const impact = a.start + IMPACT_OFFSET;
		const since = frame - impact;
		if (since < 0 || since > 12) return acc;
		const decay = Math.exp(-since / 3);
		return acc + Math.sin(since * 1.9) * 11 * decay;
	}, 0);

	const title = spring({ frame: frame - 2, fps, config: { damping: 12, mass: 0.8, stiffness: 200 } });

	return (
		<AbsoluteFill style={{ background: dark.base200, transform: `translateY(${shake}px)` }}>
			{/* Floor the anvils land on */}
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: floorY,
					bottom: 0,
					background: dark.base300,
					borderTop: `4px solid ${dark.baseContent}`,
				}}
			/>

			<div
				style={{
					position: "absolute",
					// Vertical anchors the title just above the pile rather than
					// at the very top, which would leave a void between them.
					top: f.v(Math.round(f.height * 0.3), 90),
					left: f.pad,
					right: f.pad,
					textAlign: "center",
					font: `700 ${f.v(34, 30)}px/1.35 ${font.sans}`,
					letterSpacing: "0.16em",
					textTransform: "uppercase",
					color: `color-mix(in oklch, ${dark.baseContent} 55%, transparent)`,
					opacity: title,
					transform: `scale(${0.85 + title * 0.15})`,
				}}
			>
				Managing property the old way
			</div>

			{anvils.map((a) => (
				<Dust key={`${a.label}-dust`} at={a.start + IMPACT_OFFSET} x={a.x} y={a.restY} />
			))}
			{anvils.map((a) => (
				<FallingBlock key={a.label} anvil={a} />
			))}
		</AbsoluteFill>
	);
};
