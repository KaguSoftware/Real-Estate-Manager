"use client";

/**
 * TeamSizeCard — owner-only card on /team to change the team's group-size
 * bracket (the "how many people" answer from onboarding). It's informational
 * only — no seats/limits depend on it — but owners asked to be able to edit it
 * after signup. RLS + the teams guard trigger allow this non-sensitive field;
 * the card is hidden from agents. A confirm dialog gates the write.
 */

import { useState } from "react";
import { useAppStore } from "@/src/store";
import { fetchTeamContext, updateTeamSize, type TeamSizeBracket } from "@/src/lib/db/teams";
import { Card, CardLabel, Alert, ConfirmDialog, toast, cn } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

const SIZE_BRACKETS: { value: TeamSizeBracket; label: string }[] = [
	{ value: "solo", label: "Sadece ben" },
	{ value: "2-5", label: "2–5" },
	{ value: "6-20", label: "6–20" },
	{ value: "20+", label: "20+" },
];

export function TeamSizeCard() {
	const team = useAppStore((s) => s.team);
	const setTeam = useAppStore((s) => s.setTeam);
	const [pending, setPending] = useState<TeamSizeBracket | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!team) return null;
	const current = team.size_bracket;

	async function confirmChange() {
		if (!pending) return;
		setError(null);
		setBusy(true);
		try {
			await updateTeamSize(pending);
			setTeam(await fetchTeamContext());
			toast.success("Ekip boyutu güncellendi.");
			setPending(null);
		} catch (err) {
			setError(humanizeError(err));
			setPending(null);
		} finally {
			setBusy(false);
		}
	}

	const pendingLabel = SIZE_BRACKETS.find((b) => b.value === pending)?.label;

	return (
		<Card>
			<CardLabel>Ekip boyutu</CardLabel>
			<p className="text-xs text-base-content/60 mt-1">
				Kagu&apos;yu kaç kişinin kullandığı. Yalnızca bilgi amaçlıdır; abonelik veya
				üye sınırını etkilemez.
			</p>
			{error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
			<div className="mt-3 grid grid-cols-4 gap-1 bg-base-200 rounded-xl p-1 max-w-sm">
				{SIZE_BRACKETS.map((b) => (
					<button
						key={b.value}
						type="button"
						disabled={busy}
						onClick={() => { if (b.value !== current) setPending(b.value); }}
						className={cn(
							"h-9 text-sm font-medium rounded-lg transition-colors",
							b.value === current
								? "bg-base-100 text-base-content shadow-soft"
								: "text-base-content/60 hover:text-base-content/80",
						)}
					>
						{b.label}
					</button>
				))}
			</div>

			<ConfirmDialog
				open={pending !== null}
				title="Ekip boyutu değiştirilsin mi?"
				message={
					pendingLabel
						? `Ekip boyutu "${pendingLabel}" olarak güncellenecek.`
						: undefined
				}
				confirmLabel="Güncelle"
				cancelLabel="Vazgeç"
				loading={busy}
				onConfirm={confirmChange}
				onCancel={() => setPending(null)}
			/>
		</Card>
	);
}
