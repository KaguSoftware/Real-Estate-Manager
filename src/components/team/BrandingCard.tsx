"use client";

/**
 * BrandingCard — owner-only card on /team: upload/remove the team logo
 * (shown in the navbar and generated PDFs) and pick the PDF color palette.
 * RLS enforces owner-only writes; the card is simply hidden from agents.
 */

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useAppStore } from "@/src/store";
import {
	fetchTeamContext,
	getTeamLogoUrl,
	removeTeamLogo,
	updateTeamPalette,
	uploadTeamLogo,
} from "@/src/lib/db/teams";
import { BRAND_PALETTES } from "@/src/lib/pdf/branding";
import { Card, CardLabel, Button, Alert, toast, cn } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

export function BrandingCard() {
	const team = useAppStore((s) => s.team);
	const setTeam = useAppStore((s) => s.setTeam);
	const fileRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	if (!team) return null;
	const logoUrl = getTeamLogoUrl(team.logo_path);
	// Branding writes are gated by team_is_writable() in RLS; when the trial has
	// lapsed with no active subscription, an upload would come back as a raw
	// "no permission" error. Surface the paywall reason instead and lock the controls.
	const locked = !team.is_writable;

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

	async function onPalette(id: string) {
		if (!team || id === team.brand_palette) return;
		setError(null);
		setBusy(`palette-${id}`);
		try {
			await updateTeamPalette(id);
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
				<p className="text-xs font-semibold text-base-content/70 mb-2">Belge renk paleti</p>
				<div className="flex flex-wrap gap-2">
					{Object.values(BRAND_PALETTES).map((p) => (
						<button
							key={p.id}
							type="button"
							onClick={() => onPalette(p.id)}
							disabled={busy !== null || locked}
							aria-pressed={team.brand_palette === p.id}
							className={cn(
								"flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
								team.brand_palette === p.id
									? "border-primary ring-2 ring-primary/30 text-base-content"
									: "border-base-300 text-base-content/70 hover:border-base-content/30",
							)}
						>
							<span className="flex -space-x-1">
								<span className="h-4 w-4 rounded-full border border-base-100" style={{ backgroundColor: p.primary }} />
								<span className="h-4 w-4 rounded-full border border-base-100" style={{ backgroundColor: p.accent }} />
								<span className="h-4 w-4 rounded-full border border-base-100" style={{ backgroundColor: p.muted }} />
							</span>
							{p.label}
						</button>
					))}
				</div>
			</div>
		</Card>
	);
}
