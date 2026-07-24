/**
 * Brand tokens + spring physics for the promo video.
 *
 * The OKLCH values are copied verbatim from the "estate" / "estate-dark"
 * daisyUI themes in src/app/globals.css. They are duplicated rather than
 * imported because Remotion renders outside the Next.js/Tailwind pipeline —
 * if the app's palette changes, re-copy it here.
 */

/** Light "estate" surfaces — the app's default theme. */
export const light = {
	base100: "oklch(99% 0.001 250)",
	base200: "oklch(96.5% 0.003 250)",
	base300: "oklch(90.5% 0.005 250)",
	baseContent: "oklch(22% 0.012 255)",
	primary: "oklch(54% 0.155 35)",
	primaryContent: "oklch(98.5% 0.008 40)",
	accent: "oklch(62% 0.13 42)",
	neutral: "oklch(27% 0.012 255)",
	success: "oklch(56% 0.13 160)",
	warning: "oklch(70% 0.14 75)",
	error: "oklch(55% 0.2 25)",
} as const;

/** Dark "estate-dark" surfaces — used for the chaos act. */
export const dark = {
	base100: "oklch(21.5% 0.01 255)",
	base200: "oklch(17.5% 0.008 255)",
	base300: "oklch(29% 0.012 255)",
	baseContent: "oklch(93% 0.006 250)",
	primary: "oklch(70% 0.155 38)",
	primaryContent: "oklch(16% 0.04 38)",
	accent: "oklch(78% 0.11 45)",
	neutral: "oklch(90% 0.006 250)",
	success: "oklch(74% 0.12 160)",
	warning: "oklch(80% 0.13 85)",
	error: "oklch(68% 0.17 20)",
} as const;

/** Badge tones mirrored from src/components/ui Badge + leadStatus.ts. */
export const tone = {
	slate: { bg: "oklch(93% 0.006 255)", fg: "oklch(35% 0.015 255)" },
	red: { bg: "oklch(92% 0.04 25)", fg: "oklch(45% 0.17 25)" },
	amber: { bg: "oklch(94% 0.06 85)", fg: "oklch(45% 0.12 70)" },
	indigo: { bg: "oklch(93% 0.04 275)", fg: "oklch(45% 0.15 275)" },
	emerald: { bg: "oklch(93% 0.05 160)", fg: "oklch(42% 0.11 160)" },
	blue: { bg: "oklch(93% 0.04 240)", fg: "oklch(45% 0.14 240)" },
} as const;

export type Tone = keyof typeof tone;

/** App typography — matches src/app/layout.tsx. */
export const font = {
	sans: "'Schibsted Grotesk', system-ui, sans-serif",
	mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

export const radius = { field: 8, box: 12, selector: 8 } as const;

/* ── Spring physics ───────────────────────────────────────────────────────
   Cartoon rubber-band feel: low damping so it oscillates, high mass so it
   carries weight through the overshoot. Anything below damping ~8 rings for
   a long time — that is the point for ANVIL, but scene entrances need to
   settle before the shot cuts, hence the tighter SNAP/POP configs.
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Act 1 anvils use hand-driven gravity rather than a spring — see
 * scenes/Chaos.tsx. A spring's defining behaviour is ringing, and an anvil
 * should drop, hit once and stop dead; every damping value either rang too
 * long or killed the impact. ANVIL_FALL/ANVIL_REBOUND tune that motion.
 */

/**
 * Frames from release to floor contact. At 30fps, 17 frames ≈ 0.57s — quick and
 * heavy while still reading as a fall. Below ~12 the block crosses the frame in
 * a couple of frames and reads as a cut rather than a drop.
 */
export const ANVIL_FALL = 17;

/**
 * Height of the single rebound hop, in px. Fixed rather than a fraction of the
 * fall: blocks landing higher up the stack fall a shorter distance, and scaling
 * the hop to that made the top block bounce highest — backwards for something
 * that is supposed to read as equally heavy.
 */
export const ANVIL_REBOUND = 54;

/** Frames the rebound hop takes (up and back down). */
export const ANVIL_REBOUND_FRAMES = 13;

/** UI elements snapping into place. Overshoots once, then settles. */
export const SNAP = { damping: 11, mass: 1.1, stiffness: 190, overshootClamping: false } as const;

/** Small elements popping in — punchier, quicker settle. */
export const POP = { damping: 9, mass: 0.7, stiffness: 220, overshootClamping: false } as const;

/** Big playful scale-ups — the outro branding. */
export const BOUNCE = { damping: 8, mass: 1.6, stiffness: 150, overshootClamping: false } as const;

/** Screen wipes — travels fast, no ring (a wipe that wobbles reads as a bug). */
export const WIPE = { damping: 200, mass: 1, stiffness: 90, overshootClamping: true } as const;
