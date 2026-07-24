/**
 * ACT 2 / SCENE B — LEAD FIX (0:16–0:21)
 *
 * A LeadForm lookalike pops in, a cursor drives to "Kaydet" and clicks, the
 * click fires a particle burst, and the new lead card flies into the "Yeni"
 * column of the pipeline. Field labels and the five pipeline stages mirror
 * src/components/leads/.
 */

import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { light, font, radius, SNAP, POP, BOUNCE } from "../theme";
import { Card, Badge, Button, Field } from "../components/ui";
import { newLead, pipeline, pipelineCompact } from "../mockData";
import { useFormat, type Format } from "../format";

/** Frames, relative to scene start. */
const CLICK = 44;
const FLY = CLICK + 4;

/** Form geometry, shared by the form, the cursor and the burst. */
const useForm = (f: Format) => {
	const width = Math.min(620, f.width - f.pad * 2);
	// Vertical: sits in the upper half, above the centred pipeline board.
	const top = f.v(230, 128);
	// The submit button sits at the form's bottom-right. Deriving these from the
	// form box keeps the cursor on the button in both formats — hardcoded
	// coordinates would have it clicking empty space at 1080×1920.
	const height = f.v(496, 470);
	return {
		width,
		top,
		left: f.cx - width / 2,
		btnX: f.cx + width / 2 - 76,
		btnY: top + height - 34,
	};
};

const Cursor: React.FC<{ at: { x: number; y: number } }> = ({ at }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Drive in from lower-right to the submit button.
	const travel = spring({ frame: frame - 20, fps, config: { damping: 16, mass: 0.9, stiffness: 130 } });
	const x = interpolate(travel, [0, 1], [420, 0]);
	const y = interpolate(travel, [0, 1], [300, 0]);

	// Press-down dip on click.
	const press = spring({ frame: frame - CLICK, fps, config: { damping: 14, mass: 0.4, stiffness: 420 } });
	const dip = interpolate(press, [0, 1], [0, 1]) * (frame < CLICK + 8 ? 1 : 0);
	const scale = 1 - dip * 0.22;

	return (
		<div
			style={{
				position: "absolute",
				left: at.x,
				top: at.y,
				transform: `translate(${x}px, ${y}px) scale(${scale})`,
				zIndex: 20,
			}}
		>
			<svg width="34" height="34" viewBox="0 0 24 24" fill="none">
				<path
					d="M5 2.5 L5 19 L9.2 15.2 L11.9 21.2 L14.8 19.9 L12.1 14 L18 13.6 Z"
					fill={light.baseContent}
					stroke={light.base100}
					strokeWidth="1.6"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	);
};

const Burst: React.FC<{ at: { x: number; y: number } }> = ({ at }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	if (frame < CLICK) return null;

	const t = spring({ frame: frame - CLICK, fps, config: { damping: 200, mass: 0.6, stiffness: 110 } });
	const N = 14;

	return (
		<div style={{ position: "absolute", left: at.x + 14, top: at.y + 14, zIndex: 19 }}>
			{Array.from({ length: N }).map((_, i) => {
				const angle = (i / N) * Math.PI * 2;
				const dist = t * (95 + (i % 3) * 34);
				return (
					<div
						key={i}
						style={{
							position: "absolute",
							width: i % 2 ? 9 : 13,
							height: i % 2 ? 9 : 13,
							borderRadius: i % 3 === 0 ? 2 : "50%",
							background: i % 2 ? light.primary : light.accent,
							transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) rotate(${t * 220}deg)`,
							opacity: interpolate(t, [0, 0.55, 1], [1, 0.85, 0]),
						}}
					/>
				);
			})}
		</div>
	);
};

export const SceneLead: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const f = useFormat();
	const form = useForm(f);
	const columns = f.vertical ? pipelineCompact : pipeline;

	const formIn = spring({ frame, fps, config: SNAP });
	const formScale = interpolate(formIn, [0, 1], [0.72, 1]);

	// After the click the form recoils and drops away.
	const dismiss = spring({ frame: frame - CLICK - 10, fps, config: POP });
	const formOut = frame > CLICK + 10 ? dismiss : 0;

	// The lead card's flight from the form into the pipeline's first column.
	const fly = spring({ frame: frame - FLY, fps, config: BOUNCE });

	const caption = spring({ frame: frame - 4, fps, config: POP });

	return (
		<AbsoluteFill
			style={{
				background: light.base200,
				padding: f.pad,
				// Vertical centres the board in the frame; landscape keeps the
				// board top-aligned under the form.
				justifyContent: f.v("center", "flex-start"),
			}}
		>
			<div
				style={{
					position: "absolute",
					top: f.v(96, 62),
					left: f.pad,
					right: f.pad,
					textAlign: "center",
					font: `800 ${f.v(50, 40)}px/1.2 ${font.sans}`,
					letterSpacing: "-0.02em",
					color: light.baseContent,
					opacity: caption,
					transform: `scale(${0.8 + caption * 0.2})`,
				}}
			>
				Every lead, captured.
			</div>

			{/* Pipeline board — always present; the lead lands in it. Sits below
			    the form in both formats, vertically centred in the space left. */}
			<div
				style={{
					display: "flex",
					gap: f.v(10, 14),
					marginTop: f.v(0, 150),
				}}
			>
				{columns.map((col, i) => {
					const t = spring({ frame: frame - 8 - i * 3, fps, config: POP });
					const isTarget = i === 0;
					const landed = isTarget && fly > 0.55;

					return (
						<Card
							key={col.label}
							style={{
								flex: 1,
								minWidth: 0,
								padding: f.v(11, 14),
								// Taller on 9:16 so the board occupies the lower
								// half rather than floating as a thin strip.
								minHeight: f.v(620, 300),
								background: light.base100,
								transform: `translateY(${interpolate(t, [0, 1], [70, 0])}px) scale(${
									landed ? 1 + (1 - Math.min(1, (fly - 0.55) / 0.45)) * 0.05 : 1
								})`,
								opacity: t,
							}}
						>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<Badge tone={col.tone}>{col.label}</Badge>
								<span
									style={{
										font: `600 14px/1 ${font.mono}`,
										color: `color-mix(in oklch, ${light.baseContent} 45%, transparent)`,
									}}
								>
									{col.leads.length + (landed ? 1 : 0)}
								</span>
							</div>

							<div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14 }}>
								{/* The freshly-captured lead, once it lands. */}
								{isTarget && landed && (
									<div
										style={{
											background: `color-mix(in oklch, ${light.primary} 10%, ${light.base100})`,
											border: `2px solid ${light.primary}`,
											borderRadius: radius.field,
											padding: "11px 13px",
											font: `600 15px/1.3 ${font.sans}`,
											color: light.baseContent,
										}}
									>
										{newLead.full_name}
									</div>
								)}
								{col.leads.map((name) => (
									<div
										key={name}
										style={{
											background: light.base200,
											border: `1px solid ${light.base300}`,
											borderRadius: radius.field,
											padding: "11px 13px",
											font: `500 15px/1.3 ${font.sans}`,
											color: light.baseContent,
										}}
									>
										{name}
									</div>
								))}
							</div>
						</Card>
					);
				})}
			</div>

			{/* The form itself — a Sheet-style panel, as in the real app. */}
			{formOut < 0.98 && (
				<div
					style={{
						position: "absolute",
						left: form.left,
						top: form.top,
						width: form.width,
						transform: `translateY(${interpolate(formOut, [0, 1], [0, 200])}px) scale(${
							formScale * (1 - formOut * 0.35)
						})`,
						opacity: 1 - formOut,
						zIndex: 10,
					}}
				>
					<Card style={{ padding: 30 }}>
						<p
							style={{
								font: `700 26px/1.2 ${font.sans}`,
								color: light.baseContent,
								margin: "0 0 22px",
							}}
						>
							Müşteri ekle
						</p>

						<div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
							{[
								["Ad soyad", newLead.full_name],
								["Telefon", newLead.phone],
								["E-posta", newLead.email],
								["İlgilendiği", newLead.interested_in],
							].map(([label, value], i) => {
								const t = spring({ frame: frame - 10 - i * 4, fps, config: POP });
								return (
									<Field
										key={label}
										label={label}
										value={value}
										style={{
											transform: `translateX(${interpolate(t, [0, 1], [-40, 0])}px)`,
											opacity: t,
										}}
									/>
								);
							})}
						</div>

						<div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 26 }}>
							<Button variant="ghost">İptal</Button>
							<Button
								style={{
									transform: `scale(${frame >= CLICK && frame < CLICK + 8 ? 0.93 : 1})`,
								}}
							>
								Kaydet
							</Button>
						</div>
					</Card>
				</div>
			)}

			{frame < CLICK + 10 && <Cursor at={{ x: form.btnX, y: form.btnY }} />}
			<Burst at={{ x: form.btnX, y: form.btnY }} />
		</AbsoluteFill>
	);
};
