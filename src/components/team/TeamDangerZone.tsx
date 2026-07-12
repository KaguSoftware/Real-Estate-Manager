"use client";

/**
 * TeamDangerZone — bottom-of-/team card for the irreversible actions added in
 * migration 0014: owners transfer ownership or delete the team; agents leave.
 * All enforcement is in the SECURITY DEFINER RPCs; this is the UI for them.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import {
	deleteTeam,
	fetchTeamContext,
	leaveTeam,
	transferOwnership,
	type TeamMember,
} from "@/src/lib/db/teams";
import { Card, CardLabel, Button, Alert, Dropdown, ConfirmDialog } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

export function TeamDangerZone({ members }: { members: TeamMember[] }) {
	const team = useAppStore((s) => s.team);
	const setTeam = useAppStore((s) => s.setTeam);
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [transferTo, setTransferTo] = useState("");
	const [confirm, setConfirm] = useState<"transfer" | "leave" | "delete" | null>(null);
	const [deleteText, setDeleteText] = useState("");
	const [busy, setBusy] = useState(false);

	if (!team) return null;
	const isOwner = team.role === "owner";
	const others = members.filter((m) => m.role !== "owner");

	async function run(action: () => Promise<void>, after: "refresh" | "exit") {
		setError(null);
		setBusy(true);
		try {
			await action();
			if (after === "exit") {
				setTeam(null);
				router.replace("/onboarding");
			} else {
				setTeam(await fetchTeamContext());
			}
			setConfirm(null);
		} catch (err) {
			setError(humanizeError(err));
			setConfirm(null);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card>
			<CardLabel>Tehlikeli bölge</CardLabel>
			{error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

			{isOwner ? (
				<div className="mt-3 space-y-5">
					<div>
						<p className="text-sm font-semibold text-base-content">Sahipliği devret</p>
						<p className="text-xs text-base-content/60 mt-0.5">
							Ekip yönetimi ve abonelik seçilen üyeye geçer; siz danışman olursunuz.
						</p>
						<div className="mt-2 flex gap-2 items-center max-w-sm">
							<Dropdown
								options={others.map((m) => ({ value: m.user_id, label: m.display_name || m.email }))}
								value={transferTo}
								onChange={setTransferTo}
								placeholder="Üye seçin…"
							/>
							<Button
								variant="outline"
								size="sm"
								disabled={!transferTo}
								onClick={() => setConfirm("transfer")}
							>
								Devret
							</Button>
						</div>
						{others.length === 0 && (
							<p className="text-xs text-base-content/50 mt-1">
								Devretmek için önce başka bir üye davet edin.
							</p>
						)}
					</div>

					<div className="border-t border-base-300 pt-4">
						<p className="text-sm font-semibold text-error">Ekibi sil</p>
						<p className="text-xs text-base-content/60 mt-0.5">
							Tüm portföy, müşteri, kiracı, sözleşme ve belge verileri kalıcı olarak silinir.
							Bu işlem geri alınamaz. Onaylamak için <span className="font-mono font-semibold">SIL</span> yazın.
						</p>
						<div className="mt-2 flex gap-2 items-center max-w-sm">
							<input
								value={deleteText}
								onChange={(e) => setDeleteText(e.target.value)}
								placeholder="SIL"
								className="input input-bordered input-sm w-28 font-mono"
								aria-label="Silme onayı"
							/>
							<Button
								variant="outline"
								size="sm"
								className="text-error border-error/40 hover:bg-error/10"
								disabled={deleteText.trim().toUpperCase() !== "SIL"}
								onClick={() => setConfirm("delete")}
							>
								Ekibi kalıcı olarak sil
							</Button>
						</div>
					</div>
				</div>
			) : (
				<div className="mt-3">
					<p className="text-sm font-semibold text-base-content">Ekipten ayrıl</p>
					<p className="text-xs text-base-content/60 mt-0.5">
						Ekip verilerine erişiminiz kalkar; hesabınız silinmez.
					</p>
					<Button variant="outline" size="sm" className="mt-2" onClick={() => setConfirm("leave")}>
						Ekipten ayrıl
					</Button>
				</div>
			)}

			<ConfirmDialog
				open={confirm === "transfer"}
				title="Sahiplik devredilsin mi?"
				message="Ekip yönetimi ve abonelik kontrolü seçilen üyeye geçer. Bu işlemi yalnızca yeni sahip geri alabilir."
				confirmLabel="Sahipliği devret"
				cancelLabel="Vazgeç"
				loading={busy}
				onConfirm={() => run(() => transferOwnership(transferTo), "refresh")}
				onCancel={() => setConfirm(null)}
			/>
			<ConfirmDialog
				open={confirm === "leave"}
				title="Ekipten ayrılınsın mı?"
				message="Ekip verilerine erişiminiz sona erer. Yeniden katılmak için yeni bir davet gerekir."
				confirmLabel="Ekipten ayrıl"
				cancelLabel="Vazgeç"
				loading={busy}
				onConfirm={() => run(() => leaveTeam(), "exit")}
				onCancel={() => setConfirm(null)}
			/>
			<ConfirmDialog
				open={confirm === "delete"}
				title="Ekip kalıcı olarak silinsin mi?"
				message="Tüm ekip verileri (portföy, müşteriler, kiracılar, sözleşmeler, belgeler) kalıcı olarak silinir. Bu işlem geri alınamaz."
				confirmLabel="Evet, ekibi sil"
				cancelLabel="Vazgeç"
				loading={busy}
				onConfirm={() => run(() => deleteTeam(), "exit")}
				onCancel={() => setConfirm(null)}
			/>
		</Card>
	);
}
