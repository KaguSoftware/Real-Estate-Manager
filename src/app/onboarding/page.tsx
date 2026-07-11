"use client";

/**
 * /onboarding — multi-step wizard for signed-in users without a team
 * (proxy.ts redirects them here).
 *
 * Steps: choose (start vs join) → profile (name/phone) → team details
 * (create path) or invite code (join path). Creators become owners with a
 * 14-day trial; joiners are added as agents (DB-enforced).
 *
 * A pending invite code (set by /join/[code] before sign-in) is auto-accepted
 * on arrival, so email-invite and share-link flows work for brand-new signups.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, UserPlus } from "lucide-react";
import { useAppStore } from "@/src/store";
import {
	createTeam,
	acceptInvite,
	fetchTeamContext,
	type TeamSizeBracket,
} from "@/src/lib/db/teams";
import { updateMyProfile, getMyProfile } from "@/src/lib/db/profiles";
import { AuthModal } from "@/src/components/auth/AuthModal";
import { toast, Button, Card, Alert, FormField, Input, Select, cn } from "@/src/components/ui";

// Must match the cookie set by /join/[code]/route.ts
const PENDING_INVITE_COOKIE = "kagu_pending_invite";

function readPendingInvite(): string | null {
	const m = document.cookie.match(new RegExp(`(?:^|; )${PENDING_INVITE_COOKIE}=([^;]*)`));
	return m ? decodeURIComponent(m[1]) : null;
}

function clearPendingInvite() {
	document.cookie = `${PENDING_INVITE_COOKIE}=; path=/; max-age=0`;
}

const SIZE_BRACKETS: { value: TeamSizeBracket; label: string }[] = [
	{ value: "solo", label: "Just me" },
	{ value: "2-5", label: "2–5" },
	{ value: "6-20", label: "6–20" },
	{ value: "20+", label: "20+" },
];

const REFERRAL_SOURCES = [
	{ value: "", label: "Select one (optional)" },
	{ value: "google", label: "Google search" },
	{ value: "social", label: "Social media" },
	{ value: "referral", label: "A colleague or friend" },
	{ value: "ad", label: "An advertisement" },
	{ value: "other", label: "Other" },
];

type Step = "choose" | "profile" | "team" | "join";

export default function OnboardingPage() {
	const router = useRouter();
	const user = useAppStore((s) => s.user);
	const setTeam = useAppStore((s) => s.setTeam);

	const [step, setStep] = useState<Step>("choose");
	// After "profile", continue to "team" (create path) or "join".
	const [path, setPath] = useState<"create" | "join">("create");

	const [fullName, setFullName] = useState("");
	const [phone, setPhone] = useState("");
	const [teamName, setTeamName] = useState("");
	const [sizeBracket, setSizeBracket] = useState<TeamSizeBracket | null>(null);
	const [city, setCity] = useState("");
	const [country, setCountry] = useState("");
	const [referralSource, setReferralSource] = useState("");
	const [code, setCode] = useState("");

	const [busy, setBusy] = useState<"create" | "join" | "auto" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showAuth, setShowAuth] = useState(false);

	async function finish(message: string) {
		const team = await fetchTeamContext();
		setTeam(team);
		toast.success(message);
		router.replace("/");
	}

	// Prefill the name from the profile (e.g. set at a previous attempt).
	useEffect(() => {
		if (!user) return;
		getMyProfile().then((p) => {
			if (!p) return;
			setFullName((v) => v || p.full_name || p.display_name || "");
			setPhone((v) => v || p.phone || "");
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id]);

	// Auto-accept a pending invite (set by /join/[code]) once signed in.
	useEffect(() => {
		if (!user) return;
		const pending = readPendingInvite();
		if (!pending) return;
		setBusy("auto");
		acceptInvite(pending)
			.then(async (teamId) => {
				clearPendingInvite();
				void teamId;
				const team = await fetchTeamContext();
				setTeam(team);
				toast.success(`You've joined ${team?.name ?? "the team"} as an agent 🎉`);
				router.replace("/");
			})
			.catch((e: Error) => {
				clearPendingInvite();
				setBusy(null);
				setError(e.message || "Invite could not be accepted");
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id]);

	async function saveProfile() {
		await updateMyProfile({ fullName, phone });
	}

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy("create");
		try {
			await saveProfile();
			await createTeam({
				name: teamName.trim(),
				sizeBracket: sizeBracket ?? undefined,
				city: city.trim() || undefined,
				country: country.trim() || undefined,
				referralSource: referralSource || undefined,
			});
			await finish("Your 14-day free trial has started 🎉");
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
			await saveProfile();
			await acceptInvite(code.trim());
			const team = await fetchTeamContext();
			setTeam(team);
			toast.success(`You've joined ${team?.name ?? "the team"} as an agent 🎉`);
			router.replace("/");
		} catch (err) {
			setBusy(null);
			setError(err instanceof Error ? err.message : "Could not join the team");
		}
	}

	function backBtn(to: Step) {
		return (
			<button
				type="button"
				onClick={() => { setError(null); setStep(to); }}
				className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600"
			>
				<ArrowLeft className="w-4 h-4" /> Back
			</button>
		);
	}

	const stepIndex = step === "choose" ? 0 : step === "profile" ? 1 : 2;

	return (
		<div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
			<div className="w-full max-w-md space-y-4">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-slate-900">Welcome to Kagu</h1>
					<p className="text-sm text-slate-500 mt-1">
						Set up your agency team, or join one you were invited to.
					</p>
				</div>

				{/* Step dots */}
				{user && busy !== "auto" && (
					<div className="flex justify-center gap-1.5" aria-hidden>
						{[0, 1, 2].map((i) => (
							<span
								key={i}
								className={cn(
									"h-1.5 rounded-full transition-all",
									i === stepIndex ? "w-6 bg-primary" : "w-1.5 bg-slate-300",
								)}
							/>
						))}
					</div>
				)}

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
				) : step === "choose" ? (
					<div className="space-y-3">
						<button
							type="button"
							onClick={() => { setPath("create"); setStep("profile"); }}
							className="w-full text-left"
						>
							<Card className="space-y-1 hover:border-primary/40 border border-transparent transition-colors">
								<div className="flex items-center gap-2 text-slate-900 font-semibold">
									<Building2 className="w-5 h-5 text-primary" /> Start a new team
								</div>
								<p className="text-xs text-slate-500">
									You become the owner and get a 14-day free trial for your whole team.
								</p>
							</Card>
						</button>
						<button
							type="button"
							onClick={() => { setPath("join"); setStep("profile"); }}
							className="w-full text-left"
						>
							<Card className="space-y-1 hover:border-primary/40 border border-transparent transition-colors">
								<div className="flex items-center gap-2 text-slate-900 font-semibold">
									<UserPlus className="w-5 h-5 text-primary" /> Join an existing team
								</div>
								<p className="text-xs text-slate-500">
									Someone sent you an invite link or code? You&apos;ll join as an agent.
								</p>
							</Card>
						</button>
					</div>
				) : step === "profile" ? (
					<Card>
						<form
							onSubmit={(e) => { e.preventDefault(); setStep(path === "create" ? "team" : "join"); }}
							className="space-y-4"
						>
							{backBtn("choose")}
							<div className="text-slate-900 font-semibold">Tell us about yourself</div>
							<FormField label="Full name">
								<Input
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									placeholder="e.g. Ayşe Yılmaz"
									required
									maxLength={80}
									autoFocus
								/>
							</FormField>
							<FormField label="Phone (optional)">
								<Input
									type="tel"
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
									placeholder="+90 5xx xxx xx xx"
									maxLength={30}
								/>
							</FormField>
							<Button type="submit" block disabled={!fullName.trim()}>Continue</Button>
						</form>
					</Card>
				) : step === "team" ? (
					<Card>
						<form onSubmit={onCreate} className="space-y-4">
							{backBtn("profile")}
							<div className="flex items-center gap-2 text-slate-900 font-semibold">
								<Building2 className="w-5 h-5 text-primary" /> Create your team
							</div>
							<FormField label="Team name">
								<Input
									value={teamName}
									onChange={(e) => setTeamName(e.target.value)}
									placeholder="e.g. Kagu Real Estate"
									required
									maxLength={80}
									autoFocus
								/>
							</FormField>
							<FormField label="How many people will use Kagu?">
								<div className="grid grid-cols-4 gap-1 bg-slate-100 rounded-xl p-1">
									{SIZE_BRACKETS.map((b) => (
										<button
											key={b.value}
											type="button"
											onClick={() => setSizeBracket(b.value)}
											className={cn(
												"h-9 text-sm font-medium rounded-lg transition-colors",
												sizeBracket === b.value
													? "bg-white text-slate-800 shadow-soft"
													: "text-slate-500 hover:text-slate-700",
											)}
										>
											{b.label}
										</button>
									))}
								</div>
							</FormField>
							<div className="grid grid-cols-2 gap-3">
								<FormField label="City">
									<Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Istanbul" maxLength={60} />
								</FormField>
								<FormField label="Country">
									<Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Türkiye" maxLength={60} />
								</FormField>
							</div>
							<FormField label="How did you hear about us?">
								<Select value={referralSource} onChange={(e) => setReferralSource(e.target.value)}>
									{REFERRAL_SOURCES.map((o) => (
										<option key={o.value} value={o.value}>{o.label}</option>
									))}
								</Select>
							</FormField>
							<Button type="submit" block loading={busy === "create"} disabled={!teamName.trim()}>
								Create team & start free trial
							</Button>
						</form>
					</Card>
				) : (
					<Card>
						<form onSubmit={onJoin} className="space-y-4">
							{backBtn("profile")}
							<div className="flex items-center gap-2 text-slate-900 font-semibold">
								<UserPlus className="w-5 h-5 text-primary" /> Join with an invite code
							</div>
							<FormField label="Invite code">
								<Input
									value={code}
									onChange={(e) => setCode(e.target.value)}
									placeholder="Paste your invite code"
									required
									autoFocus
								/>
							</FormField>
							<Button type="submit" block loading={busy === "join"} disabled={!code.trim()}>
								Join team
							</Button>
						</form>
					</Card>
				)}

				{showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
			</div>
		</div>
	);
}
