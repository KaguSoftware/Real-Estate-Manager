"use client";

/**
 * BrandingCard — owner-only card on /team: upload/remove the team logo
 * (shown in the navbar and generated PDFs) and pick the PDF color palette.
 * RLS enforces owner-only writes; the card is simply hidden from agents.
 */

import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { ImagePlus, Trash2, Pipette } from "lucide-react";
import { useAppStore } from "@/src/store";
import {
	fetchTeamContext,
	getTeamLogoUrl,
	removeTeamLogo,
	updateTeamColors,
	uploadTeamLogo,
} from "@/src/lib/db/teams";
import { paletteFromColors } from "@/src/lib/pdf/branding";
import { Card, CardLabel, Button, Alert, Dropdown, toast, type DropdownOption } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Curated PDF palette presets: main (headers/tables), accent1, accent2. */
const SUGGESTED_PALETTES = [
	{ id: "antrasit-kiremit", label: "Antrasit & Kiremit", main: "#1e242e", accent1: "#b74427", accent2: "#8b929e" },
	{ id: "lacivert-altin", label: "Lacivert & Altın", main: "#1b2a4a", accent1: "#c8a24b", accent2: "#7d8ba3" },
	{ id: "orman-turuncu", label: "Orman & Turuncu", main: "#1f3d2b", accent1: "#d97b29", accent2: "#8aa393" },
	{ id: "bordo-bakir", label: "Bordo & Bakır", main: "#4a1e26", accent1: "#c0803f", accent2: "#9c8f93" },
	{ id: "kahve-terrakota", label: "Kahve & Terrakota", main: "#2d2a26", accent1: "#c96f4a", accent2: "#a89f91" },
	{ id: "petrol-turkuaz", label: "Petrol & Turkuaz", main: "#123c4f", accent1: "#2f9e9b", accent2: "#92aab5" },
	{ id: "patlican-orkide", label: "Patlıcan & Orkide", main: "#2e2440", accent1: "#a4508b", accent2: "#948ba3" },
	{ id: "zeytin-hardal", label: "Zeytin & Hardal", main: "#3a3d2b", accent1: "#b5a642", accent2: "#9aa08a" },
	{ id: "komur-mercan", label: "Kömür & Mercan", main: "#26262b", accent1: "#d64541", accent2: "#8e9199" },
	{ id: "kum-kahve", label: "Kum & Kahve", main: "#4b3a2f", accent1: "#b98a4e", accent2: "#a99f8f" },
] as const;

const PALETTE_OPTIONS: DropdownOption[] = SUGGESTED_PALETTES.map((p) => ({
	value: p.id,
	label: p.label,
	swatches: [p.main, p.accent1, p.accent2],
}));

// Chromium-only native eyedropper; feature-detected before use.
interface EyeDropperAPI {
	open: () => Promise<{ sRGBHex: string }>;
}
declare global {
	interface Window {
		EyeDropper?: new () => EyeDropperAPI;
	}
}

/** One color slot: swatch button toggling a picker popover, hex text input
 *  and — where the browser supports it — an eyedropper. */
function ColorField({
	label,
	value,
	onChange,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (hex: string) => void;
	disabled: boolean;
}) {
	const [open, setOpen] = useState(false);
	// Text draft so partial input ("#b7") doesn't snap back while typing;
	// re-seeded during render whenever the committed value changes.
	const [draft, setDraft] = useState(value);
	const [prevValue, setPrevValue] = useState(value);
	if (prevValue !== value) {
		setPrevValue(value);
		setDraft(value);
	}
	const rootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	async function pickFromScreen() {
		if (!window.EyeDropper) return;
		try {
			const { sRGBHex } = await new window.EyeDropper().open();
			onChange(sRGBHex.toLowerCase());
		} catch {
			// user cancelled the eyedropper — nothing to do
		}
	}

	return (
		<div ref={rootRef} className="relative">
			<p className="text-[11px] font-medium text-base-content/60 mb-1">{label}</p>
			<div className="flex items-center gap-1.5">
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					disabled={disabled}
					aria-label={`${label} rengini seç`}
					aria-expanded={open}
					className="h-9 w-9 shrink-0 rounded-lg border border-base-300 shadow-inner disabled:opacity-50"
					style={{ backgroundColor: value }}
				/>
				<input
					type="text"
					value={draft}
					disabled={disabled}
					spellCheck={false}
					aria-label={`${label} hex kodu`}
					onChange={(e) => {
						const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
						setDraft(v);
						if (HEX_RE.test(v)) onChange(v.toLowerCase());
					}}
					onBlur={() => { if (!HEX_RE.test(draft)) setDraft(value); }}
					className="h-9 w-24 rounded-lg border border-base-300 bg-base-100 px-2 text-xs font-mono text-base-content outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
				/>
				{typeof window !== "undefined" && window.EyeDropper && (
					<button
						type="button"
						onClick={pickFromScreen}
						disabled={disabled}
						title="Ekrandan renk seç"
						aria-label={`${label} için ekrandan renk seç`}
						className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-base-300 text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors disabled:opacity-50"
					>
						<Pipette className="w-4 h-4" />
					</button>
				)}
			</div>
			{open && (
				<div className="absolute z-30 mt-2 rounded-xl border border-base-300 bg-base-100 shadow-pop p-3">
					<HexColorPicker color={value} onChange={(c) => onChange(c.toLowerCase())} />
				</div>
			)}
		</div>
	);
}

export function BrandingCard() {
	const team = useAppStore((s) => s.team);
	const setTeam = useAppStore((s) => s.setTeam);
	const fileRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Draft copies of the three brand colors; saved explicitly via "Kaydet".
	const [colors, setColors] = useState({
		main: team?.brand_color_main ?? "#1e242e",
		accent1: team?.brand_color_accent1 ?? "#b74427",
		accent2: team?.brand_color_accent2 ?? "#8b929e",
	});
	useEffect(() => {
		if (!team) return;
		let cancelled = false;
		// Sync the draft colors without a synchronous setState in the effect body.
		queueMicrotask(() => {
			if (cancelled) return;
			setColors({
				main: team.brand_color_main,
				accent1: team.brand_color_accent1,
				accent2: team.brand_color_accent2,
			});
		});
		return () => { cancelled = true; };
	}, [team?.brand_color_main, team?.brand_color_accent1, team?.brand_color_accent2]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!team) return null;
	const logoUrl = getTeamLogoUrl(team.logo_path);
	// Branding writes are gated by team_is_writable() in RLS; when the trial has
	// lapsed with no active subscription, an upload would come back as a raw
	// "no permission" error. Surface the paywall reason instead and lock the controls.
	const locked = !team.is_writable;
	// Derived PDF roles for the live preview (same math the renderer uses).
	const preview = paletteFromColors(colors.main, colors.accent1, colors.accent2);
	const dirty =
		colors.main !== team.brand_color_main ||
		colors.accent1 !== team.brand_color_accent1 ||
		colors.accent2 !== team.brand_color_accent2;

	async function refreshTeam() {
		try { setTeam(await fetchTeamContext()); } catch { /* stale team is fine */ }
	}

	async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ""; // allow re-selecting the same file
		if (!file) return;
		setError(null);
		setBusy("logo");
		try {
			await uploadTeamLogo(file);
			await refreshTeam();
			toast.success("Logo güncellendi.");
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setBusy(null);
		}
	}

	async function onRemoveLogo() {
		if (!team?.logo_path) return;
		setError(null);
		setBusy("remove");
		try {
			await removeTeamLogo(team.logo_path);
			await refreshTeam();
			toast.success("Logo kaldırıldı.");
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setBusy(null);
		}
	}

	async function onSaveColors() {
		if (!team) return;
		setError(null);
		setBusy("colors");
		try {
			await updateTeamColors(colors.main, colors.accent1, colors.accent2);
			await refreshTeam();
			toast.success("Belge renkleri güncellendi.");
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setBusy(null);
		}
	}

	return (
		<Card>
			<CardLabel>Marka görünümü</CardLabel>
			<p className="text-xs text-base-content/60 mt-1">
				Logonuz üst çubukta ve oluşturulan belgelerde görünür; renk paleti
				PDF&apos;lerinizin görünümünü belirler.
			</p>

			{error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

			{locked && (
				<div className="mt-3">
					<Alert tone="warning">
						Ücretsiz deneme süreniz doldu. Logonuzu ve belge renklerinizi
						değiştirmek için aboneliğinizi yeniden başlatın.
					</Alert>
				</div>
			)}

			<div className="mt-4 flex items-center gap-4">
				<div className="h-16 w-32 rounded-xl border border-dashed border-base-300 bg-base-200 flex items-center justify-center overflow-hidden">
					{logoUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={logoUrl} alt="Ekip logosu" className="max-h-full max-w-full object-contain" />
					) : (
						<span className="text-xs text-base-content/50">Logo yok</span>
					)}
				</div>
				<div className="flex flex-col gap-2">
					<input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPickLogo} />
					<Button variant="outline" size="sm" disabled={locked} loading={busy === "logo"} onClick={() => fileRef.current?.click()}>
						<ImagePlus className="w-4 h-4" /> {logoUrl ? "Logoyu değiştir" : "Logo yükle"}
					</Button>
					{logoUrl && (
						<Button variant="ghost" size="sm" disabled={locked} loading={busy === "remove"} onClick={onRemoveLogo}>
							<Trash2 className="w-4 h-4" /> Kaldır
						</Button>
					)}
				</div>
			</div>
			<p className="text-[11px] text-base-content/50 mt-2">PNG veya JPEG, en fazla 1 MB.</p>

			<div className="mt-5">
				<p className="text-xs font-semibold text-base-content/70 mb-1">Belge renkleri</p>
				<p className="text-[11px] text-base-content/50 mb-3">
					Logonuzun renklerini kullanın: ana renk başlık ve tablolarda, vurgu
					renkleri etiket ve detaylarda görünür. Ana renk ayrıca uygulama
					arayüzünde okunabilirlik için otomatik uyarlanmış bir vurgu tonu olarak
					kullanılır.
				</p>
				{/* Preset palettes; value reflects an exact match so manual tweaks
				    show the placeholder again instead of a stale preset name. */}
				<div className="mb-4 max-w-xs">
					<p className="text-[11px] font-medium text-base-content/60 mb-1">Önerilen paletler</p>
					<Dropdown
						options={PALETTE_OPTIONS}
						value={
							SUGGESTED_PALETTES.find(
								(p) => p.main === colors.main && p.accent1 === colors.accent1 && p.accent2 === colors.accent2,
							)?.id ?? ""
						}
						onChange={(id) => {
							const p = SUGGESTED_PALETTES.find((x) => x.id === id);
							if (p) setColors({ main: p.main, accent1: p.accent1, accent2: p.accent2 });
						}}
						placeholder="Hazır palet seçin"
						disabled={locked}
						aria-label="Önerilen renk paletleri"
					/>
				</div>
				<div className="flex flex-wrap gap-4">
					<ColorField label="Ana renk" value={colors.main} disabled={locked} onChange={(v) => setColors((c) => ({ ...c, main: v }))} />
					<ColorField label="Vurgu 1" value={colors.accent1} disabled={locked} onChange={(v) => setColors((c) => ({ ...c, accent1: v }))} />
					<ColorField label="Vurgu 2" value={colors.accent2} disabled={locked} onChange={(v) => setColors((c) => ({ ...c, accent2: v }))} />
				</div>

				{/* Live preview mirroring the PDF's main color roles. */}
				<div className="mt-4 rounded-xl border border-base-300 overflow-hidden" aria-hidden>
					<div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: preview.primary }}>
						<span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: "#ffffff" }}>
							{team.name || "Belge başlığı"}
						</span>
						<span className="text-[10px] font-semibold" style={{ color: preview.muted }}>Önizleme</span>
					</div>
					<div className="px-3 py-2.5 bg-white">
						<div className="flex items-center gap-1.5">
							<span className="h-2 w-2" style={{ backgroundColor: preview.accent }} />
							<span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: preview.primary }}>
								Bölüm başlığı
							</span>
						</div>
						<div className="mt-2 space-y-1">
							<div className="h-2 rounded-sm" style={{ backgroundColor: preview.tint }} />
							<div className="h-2 rounded-sm bg-white border" style={{ borderColor: preview.muted }} />
							<div className="h-2 rounded-sm" style={{ backgroundColor: preview.tint }} />
						</div>
					</div>
				</div>

				<div className="mt-3 flex items-center gap-2">
					<Button
						size="sm"
						disabled={locked || !dirty}
						loading={busy === "colors"}
						onClick={onSaveColors}
						style={dirty && !locked ? { backgroundColor: colors.accent1, borderColor: colors.accent1 } : undefined}
					>
						Renkleri kaydet
					</Button>
					{dirty && (
						<Button
							variant="ghost"
							size="sm"
							disabled={locked}
							onClick={() =>
								setColors({
									main: team.brand_color_main,
									accent1: team.brand_color_accent1,
									accent2: team.brand_color_accent2,
								})
							}
						>
							Vazgeç
						</Button>
					)}
				</div>
			</div>
		</Card>
	);
}
