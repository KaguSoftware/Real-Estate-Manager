"use client";

/**
 * /team — roster + invite management. RLS keeps every action safe server-side
 * (invites/removal are owner-only in the database); the UI additionally hides
 * owner controls from agents.
 */

import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Mail, RefreshCw, Trash2, UserMinus } from "lucide-react";
import { useAppStore } from "@/src/store";
import {
	listTeamMembers,
	listPendingInvites,
	getActiveLinkInvite,
	rotateInviteLink,
	revokeInvite,
	removeMember,
	type TeamMember,
	type Invite,
} from "@/src/lib/db/teams";
import {
	AppShell, Card, CardLabel, Badge, Button, FormField, EmailInput, Alert,
	ConfirmDialog, toast, SpinnerBlock,
} from "@/src/components/ui";
import { validEmail } from "@/src/lib/validation";
import { humanizeError } from "@/src/lib/errors";
import { BrandingCard } from "@/src/components/team/BrandingCard";
import { ClauseTemplatesCard } from "@/src/components/team/ClauseTemplatesCard";
import { TeamDangerZone } from "@/src/components/team/TeamDangerZone";

export default function TeamPage() {
	const user = useAppStore((s) => s.user);
	const team = useAppStore((s) => s.team);
	const isOwner = team?.role === "owner";

	const [members, setMembers] = useState<TeamMember[] | null>(null);
	const [invites, setInvites] = useState<Invite[]>([]);
	const [linkInvite, setLinkInvite] = useState<Invite | null>(null);
	const [inviteEmail, setInviteEmail] = useState("");
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [removing, setRemoving] = useState<TeamMember | null>(null);

	const reload = useCallback(async () => {
		try {
			setMembers(await listTeamMembers());
			if (isOwner) {
				setInvites(await listPendingInvites());
				setLinkInvite(await getActiveLinkInvite());
			}
		} catch (e) {
			setError(humanizeError(e));
		}
	}, [isOwner]);

	useEffect(() => {
		if (team) void reload();
	}, [team, reload]);

	const joinUrl = linkInvite
		? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${linkInvite.code}`
		: null;

	async function onInvite(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const emailErr = validEmail(inviteEmail);
		if (emailErr) { setError(emailErr); return; }
		setBusy("invite");
		try {
			const res = await fetch("/api/team/invite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: inviteEmail.trim() }),
			});
			const json = (await res.json()) as { error?: string; emailed?: boolean; notified?: boolean; joinUrl?: string };
			if (!res.ok) throw new Error(json.error || "Davet gönderilemedi");
			if (json.emailed) {
				toast.success(`Davet ${inviteEmail.trim()} adresine gönderildi.`);
			} else if (json.notified) {
				toast.success("Davet gönderildi — bu kişinin hesabı olduğu için uygulama içi bildirim aldı.");
			} else if (json.joinUrl) {
				await navigator.clipboard.writeText(json.joinUrl).catch(() => {});
				toast.info("Davet e-postası gönderilemedi — davet bağlantısı kopyalandı, doğrudan kendisine iletin.");
			}
			setInviteEmail("");
			await reload();
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setBusy(null);
		}
	}

	async function onRotate() {
		setBusy("rotate");
		try {
			await rotateInviteLink();
			await reload();
			toast.success("Yeni ekip bağlantısı oluşturuldu — eski bağlantı artık çalışmıyor.");
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setBusy(null);
		}
	}

	async function onCopyLink() {
		if (!joinUrl) return;
		await navigator.clipboard.writeText(joinUrl);
		toast.success("Ekip bağlantısı kopyalandı.");
	}

	async function onRevoke(id: string) {
		setBusy(`revoke-${id}`);
		try {
			await revokeInvite(id);
			await reload();
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setBusy(null);
		}
	}

	async function onRemoveConfirmed() {
		if (!removing) return;
		setBusy("remove");
		try {
			await removeMember(removing.user_id);
			setRemoving(null);
			await reload();
			toast.success("Üye çıkarıldı — kayıtları artık atanmamış durumda.");
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setBusy(null);
		}
	}

	return (
		<AppShell title={team ? team.name : "Ekip"} subtitle="Ekip ve davetler">
			<div className="space-y-4 px-0">
				{error && <Alert tone="error">{error}</Alert>}

				<Card>
					<CardLabel>Üyeler</CardLabel>
					{members === null ? (
						<SpinnerBlock />
					) : (
						<ul className="mt-3 divide-y divide-base-300">
							{members.map((m) => (
								<li key={m.user_id} className="py-3 flex items-center gap-3">
									<div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold uppercase">
										{(m.display_name || m.email).charAt(0)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-semibold text-base-content truncate">
											{m.display_name || m.email}
											{m.user_id === user?.id && <span className="text-base-content/50 font-normal"> (siz)</span>}
										</p>
										<p className="text-xs text-base-content/50 truncate">{m.email}</p>
									</div>
									<Badge tone={m.role === "owner" ? "indigo" : "slate"}>{m.role === "owner" ? "Ekip sahibi" : "Danışman"}</Badge>
									{isOwner && m.user_id !== user?.id && (
										<Button
											variant="danger" size="sm"
											onClick={() => setRemoving(m)}
											aria-label={`${m.display_name || m.email} üyesini çıkar`}
										>
											<UserMinus className="w-4 h-4" />
										</Button>
									)}
								</li>
							))}
						</ul>
					)}
				</Card>

				{isOwner && (
					<>
						<BrandingCard />

						<ClauseTemplatesCard />

						<Card>
							<CardLabel>E-posta ile davet et</CardLabel>
							<form onSubmit={onInvite} className="mt-3 flex flex-col sm:flex-row gap-3">
								<div className="flex-1">
									<FormField label="E-posta">
										<EmailInput
											value={inviteEmail}
											onChange={setInviteEmail}
											placeholder="danisman@ornek.com"
											required
										/>
									</FormField>
								</div>
								<Button type="submit" className="sm:self-end" loading={busy === "invite"}>
									<Mail className="w-4 h-4" /> Davet gönder
								</Button>
							</form>

							{invites.filter((i) => i.email).length > 0 && (
								<ul className="mt-4 divide-y divide-base-300">
									{invites.filter((i) => i.email).map((i) => (
										<li key={i.id} className="py-2 flex items-center gap-3">
											<p className="text-sm text-base-content/80 flex-1 truncate">{i.email}</p>
											<span className="text-xs text-base-content/50">
												son geçerlilik: {new Date(i.expires_at).toLocaleDateString("tr-TR")}
											</span>
											<Button
												variant="ghost" size="sm"
												loading={busy === `revoke-${i.id}`}
												onClick={() => onRevoke(i.id)}
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										</li>
									))}
								</ul>
							)}
						</Card>

						<Card>
							<CardLabel>Paylaşılabilir ekip bağlantısı</CardLabel>
							<p className="text-xs text-base-content/60 mt-1">
								Bu bağlantıya sahip olan herkes ekibinize katılabilir. Eski kopyaları geçersiz kılmak için bağlantıyı yenileyin.
							</p>
							<div className="mt-3 flex flex-col sm:flex-row gap-2">
								<div className="flex-1 flex items-center gap-2 rounded-xl border border-base-300 bg-base-200 px-3 h-11 text-sm text-base-content/70 min-w-0">
									<Link2 className="w-4 h-4 shrink-0 text-base-content/50" />
									<span className="truncate">{joinUrl ?? "Henüz etkin bağlantı yok"}</span>
								</div>
								{joinUrl && (
									<Button variant="outline" onClick={onCopyLink}>
										<Copy className="w-4 h-4" /> Kopyala
									</Button>
								)}
								<Button variant="outline" loading={busy === "rotate"} onClick={onRotate}>
									<RefreshCw className="w-4 h-4" /> {joinUrl ? "Yenile" : "Bağlantı oluştur"}
								</Button>
							</div>
						</Card>
					</>
				)}

				<TeamDangerZone members={members ?? []} />

				<ConfirmDialog
					open={removing !== null}
					title="Bu üye çıkarılsın mı?"
					message={
						removing
							? `${removing.display_name || removing.email} ekibe erişimini kaybedecek. Taşınmazları ve müşterileri, atanmamış olarak ekipte kalır.`
							: undefined
					}
					confirmLabel="Çıkar"
					cancelLabel="Vazgeç"
					onConfirm={onRemoveConfirmed}
					onCancel={() => setRemoving(null)}
				/>
			</div>
		</AppShell>
	);
}
