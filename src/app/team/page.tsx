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
	AppShell, Card, CardLabel, Badge, Button, FormField, Input, Alert,
	ConfirmDialog, toast, SpinnerBlock,
} from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

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
		setBusy("invite");
		try {
			const res = await fetch("/api/team/invite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: inviteEmail.trim() }),
			});
			const json = (await res.json()) as { error?: string; emailed?: boolean; joinUrl?: string };
			if (!res.ok) throw new Error(json.error || "Invite failed");
			if (json.emailed) {
				toast.success(`Invite sent to ${inviteEmail.trim()}.`);
			} else if (json.joinUrl) {
				await navigator.clipboard.writeText(json.joinUrl).catch(() => {});
				toast.info("They already have an account — invite link copied, send it to them directly.");
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
			toast.success("New team link created — the old one no longer works.");
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setBusy(null);
		}
	}

	async function onCopyLink() {
		if (!joinUrl) return;
		await navigator.clipboard.writeText(joinUrl);
		toast.success("Team link copied.");
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
			toast.success("Member removed — their records are now unassigned.");
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setBusy(null);
		}
	}

	return (
		<AppShell title={team ? team.name : "Team"} subtitle="Team & invites">
			<div className="space-y-4 px-0">
				{error && <Alert tone="error">{error}</Alert>}

				<Card>
					<CardLabel>Members</CardLabel>
					{members === null ? (
						<SpinnerBlock />
					) : (
						<ul className="mt-3 divide-y divide-slate-100">
							{members.map((m) => (
								<li key={m.user_id} className="py-3 flex items-center gap-3">
									<div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold uppercase">
										{(m.display_name || m.email).charAt(0)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-semibold text-slate-900 truncate">
											{m.display_name || m.email}
											{m.user_id === user?.id && <span className="text-slate-400 font-normal"> (you)</span>}
										</p>
										<p className="text-xs text-slate-400 truncate">{m.email}</p>
									</div>
									<Badge tone={m.role === "owner" ? "indigo" : "slate"}>{m.role}</Badge>
									{isOwner && m.user_id !== user?.id && (
										<Button
											variant="danger" size="sm"
											onClick={() => setRemoving(m)}
											aria-label={`Remove ${m.display_name || m.email}`}
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
						<Card>
							<CardLabel>Invite by email</CardLabel>
							<form onSubmit={onInvite} className="mt-3 flex flex-col sm:flex-row gap-3">
								<div className="flex-1">
									<FormField label="Email">
										<Input
											type="email"
											value={inviteEmail}
											onChange={(e) => setInviteEmail(e.target.value)}
											placeholder="agent@example.com"
											required
										/>
									</FormField>
								</div>
								<Button type="submit" className="sm:self-end" loading={busy === "invite"}>
									<Mail className="w-4 h-4" /> Send invite
								</Button>
							</form>

							{invites.filter((i) => i.email).length > 0 && (
								<ul className="mt-4 divide-y divide-slate-100">
									{invites.filter((i) => i.email).map((i) => (
										<li key={i.id} className="py-2 flex items-center gap-3">
											<p className="text-sm text-slate-700 flex-1 truncate">{i.email}</p>
											<span className="text-xs text-slate-400">
												expires {new Date(i.expires_at).toLocaleDateString()}
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
							<CardLabel>Shareable team link</CardLabel>
							<p className="text-xs text-slate-500 mt-1">
								Anyone with this link can join your team. Rotate it to cut off old copies.
							</p>
							<div className="mt-3 flex flex-col sm:flex-row gap-2">
								<div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 h-11 text-sm text-slate-600 min-w-0">
									<Link2 className="w-4 h-4 shrink-0 text-slate-400" />
									<span className="truncate">{joinUrl ?? "No active link yet"}</span>
								</div>
								{joinUrl && (
									<Button variant="outline" onClick={onCopyLink}>
										<Copy className="w-4 h-4" /> Copy
									</Button>
								)}
								<Button variant="outline" loading={busy === "rotate"} onClick={onRotate}>
									<RefreshCw className="w-4 h-4" /> {joinUrl ? "Rotate" : "Create link"}
								</Button>
							</div>
						</Card>
					</>
				)}

				<ConfirmDialog
					open={removing !== null}
					title="Remove this member?"
					message={
						removing
							? `${removing.display_name || removing.email} will lose access to the team. Their properties and clients stay with the team, unassigned.`
							: undefined
					}
					confirmLabel="Remove"
					onConfirm={onRemoveConfirmed}
					onCancel={() => setRemoving(null)}
				/>
			</div>
		</AppShell>
	);
}
