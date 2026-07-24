/**
 * Presentational lookalikes of the app's UI primitives.
 *
 * These deliberately do NOT import from src/components/ui: the real Card,
 * Badge, Sheet and friends reach into the Zustand store, next/navigation and
 * Supabase, none of which exist inside Remotion's renderer. These take plain
 * props and mirror the real components' *appearance* only.
 */

import React from "react";
import { light, tone as toneMap, font, radius, type Tone } from "../theme";

export const Card: React.FC<{
	children: React.ReactNode;
	style?: React.CSSProperties;
}> = ({ children, style }) => (
	<div
		style={{
			background: light.base100,
			border: `1px solid ${light.base300}`,
			borderRadius: radius.box,
			boxShadow: "0 1px 2px oklch(0% 0 0 / 0.05)",
			...style,
		}}
	>
		{children}
	</div>
);

export const CardLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<p
		style={{
			font: `600 12px/1.2 ${font.sans}`,
			letterSpacing: "0.04em",
			textTransform: "uppercase",
			color: `color-mix(in oklch, ${light.baseContent} 60%, transparent)`,
			margin: 0,
		}}
	>
		{children}
	</p>
);

export const Badge: React.FC<{ children: React.ReactNode; tone: Tone }> = ({ children, tone }) => {
	const t = toneMap[tone];
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				background: t.bg,
				color: t.fg,
				borderRadius: 999,
				padding: "3px 10px",
				font: `600 12px/1.4 ${font.sans}`,
				whiteSpace: "nowrap",
			}}
		>
			{children}
		</span>
	);
};

export const Button: React.FC<{
	children: React.ReactNode;
	variant?: "primary" | "ghost";
	style?: React.CSSProperties;
}> = ({ children, variant = "primary", style }) => (
	<div
		style={{
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			background: variant === "primary" ? light.primary : "transparent",
			color: variant === "primary" ? light.primaryContent : light.baseContent,
			border: variant === "ghost" ? `1px solid ${light.base300}` : "none",
			borderRadius: radius.field,
			padding: "10px 18px",
			font: `600 14px/1 ${font.sans}`,
			...style,
		}}
	>
		{children}
	</div>
);

/** Read-only field row mirroring FormField + Input from the real form. */
export const Field: React.FC<{
	label: string;
	value: string;
	style?: React.CSSProperties;
}> = ({ label, value, style }) => (
	<div style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
		<label
			style={{
				font: `500 12px/1.2 ${font.sans}`,
				color: `color-mix(in oklch, ${light.baseContent} 70%, transparent)`,
			}}
		>
			{label}
		</label>
		<div
			style={{
				background: light.base100,
				border: `1px solid ${light.base300}`,
				borderRadius: radius.field,
				padding: "9px 12px",
				font: `400 14px/1.3 ${font.sans}`,
				color: light.baseContent,
			}}
		>
			{value}
		</div>
	</div>
);
