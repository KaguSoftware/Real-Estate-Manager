"use client";

/**
 * /onboarding — where signed-in users without a team land (proxy.ts redirects
 * them here). Two paths: create a new team (become owner, 14-day trial) or
 * join an existing one with an invite code.
 *
 * A pending invite code (set by /join/[code] before sign-in) is auto-accepted
 * on arrival, so email-invite and share-link flows work for brand-new signups.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserPlus } from "lucide-react";
import { useAppStore } from "@/src/store";
import { createTeam, acceptInvite, fetchTeamContext } from "@/src/lib/db/teams";
import { AuthModal } from "@/src/components/auth/AuthModal";
import { Button, Card, Alert, FormField, Input } from "@/src/components/ui";

// Must match the cookie set by /join/[code]/route.ts
const PENDING_INVITE_COOKIE = "kagu_pending_invite";

function readPendingInvite(): string | null {
	const m = document.cookie.match(new RegExp(`(?:^|; )${PENDING_INVITE_COOKIE}=([^;]*)`));
	return m ? decodeURIComponent(m[1]) : null;
}

function clearPendingInvite() {
	document.cookie = `${PENDING_INVITE_COOKIE}=; path=/; max-age=0`;
}

export default function OnboardingPage() {
	const router = useRouter();
	const user = useAppStore((s) => s.user);
	const setTeam = useAppStore((s) => s.setTeam);

	const [teamName, setTeamName] = useState("");
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState<"create" | "join" | "auto" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showAuth, setShowAuth] = useState(false);

	async function finish() {
		const team = await fetchTeamContext();
		setTeam(team);
		router.replace("/");
	}

	// Auto-accept a pending invite (set by /join/[code]) once signed in.
	useEffect(() => {
		if (!user) return;
		const pending = readPendingInvite();
		if (!pending) return;
		setBusy("auto");
		acceptInvite(pending)
			.then(() => { clearPendingInvite(); return finish(); })
			.catch((e: Error) => {
				clearPendingInvite();
				setBusy(null);
				setError(e.message || "Invite could not be accepted");
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id]);

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy("create");
		try {
			await createTeam(teamName.trim());
			await finish();
		} catch (err) {
			setBusy(null);
			setError(err instanceof Error ? err.message : "Could not create the team");
		}
	}

	async function onJoin(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy("join");
		try {
			await acceptInvite(code.trim());
			await finish();
		} catch (err) {
			setBusy(null);
			setError(err instanceof Error ? err.message : "Could not join the team");
		}
	}

	return (
		<div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
			<div className="w-full max-w-md space-y-4">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-slate-900">Welcome to Kagu</h1>
					<p className="text-sm text-slate-500 mt-1">
						Set up your agency team, or join one you were invited to.
					</p>
				</div>

				{error && <Alert tone="error">{error}</Alert>}

				{!user ? (
					<Card className="text-center space-y-3">
						<p className="text-sm text-slate-600">Sign in or create an account to continue.</p>
						<Button block onClick={() => setShowAuth(true)}>Sign in</Button>
					</Card>
				) : busy === "auto" ? (
					<Card className="text-center">
						<p className="text-sm text-slate-600">Accepting your invite…</p>
					</Card>
				) : (
					<>
						<Card>
							<form onSubmit={onCreate} className="space-y-4">
								<div className="flex items-center gap-2 text-slate-900 font-semibold">
									<Building2 className="w-5 h-5 text-primary" /> Create a new team
								</div>
								<p className="text-xs text-slate-500">
									You become the owner and get a 14-day free trial for your whole team.
								</p>
								<FormField label="Team name">
									<Input
										value={teamName}
										onChange={(e) => setTeamName(e.target.value)}
										placeholder="e.g. Kagu Real Estate"
										required
										maxLength={80}
									/>
								</FormField>
								<Button type="submit" block loading={busy === "create"} disabled={!teamName.trim()}>
									Create team
								</Button>
							</form>
						</Card>

						<Card>
							<form onSubmit={onJoin} className="space-y-4">
								<div className="flex items-center gap-2 text-slate-900 font-semibold">
									<UserPlus className="w-5 h-5 text-primary" /> Join with an invite code
								</div>
								<FormField label="Invite code">
									<Input
										value={code}
										onChange={(e) => setCode(e.target.value)}
										placeholder="Paste your invite code"
										required
									/>
								</FormField>
								<Button type="submit" variant="outline" block loading={busy === "join"} disabled={!code.trim()}>
									Join team
								</Button>
							</form>
						</Card>
					</>
				)}

				{showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
			</div>
		</div>
	);
}
