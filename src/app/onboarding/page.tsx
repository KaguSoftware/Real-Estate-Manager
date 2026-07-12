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
import { humanizeError } from "@/src/lib/errors";
import { AuthModal } from "@/src/components/auth/AuthModal";
import { toast, Button, Card, Alert, FormField, Input, PhoneInput, Dropdown, cn } from "@/src/components/ui";

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
	{ value: "solo", label: "Sadece ben" },
	{ value: "2-5", label: "2–5" },
	{ value: "6-20", label: "6–20" },
	{ value: "20+", label: "20+" },
];

const REFERRAL_SOURCES = [
	{ value: "", label: "Seçin (isteğe bağlı)" },
	{ value: "google", label: "Google araması" },
	{ value: "social", label: "Sosyal medya" },
	{ value: "referral", label: "Bir meslektaş veya arkadaş" },
	{ value: "ad", label: "Bir reklam" },
	{ value: "other", label: "Diğer" },
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
				toast.success(team?.name ? `${team.name} ekibine danışman olarak katıldınız 🎉` : "Ekibe danışman olarak katıldınız 🎉");
				router.replace("/");
			})
			.catch((e: unknown) => {
				clearPendingInvite();
				setBusy(null);
				setError(humanizeError(e));
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
			await finish("14 günlük ücretsiz denemeniz başladı 🎉");
		} catch (err) {
			setBusy(null);
			setError(humanizeError(err));
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
			toast.success(team?.name ? `${team.name} ekibine danışman olarak katıldınız 🎉` : "Ekibe danışman olarak katıldınız 🎉");
			router.replace("/");
		} catch (err) {
			setBusy(null);
			setError(humanizeError(err));
		}
	}

	function backBtn(to: Step) {
		return (
			<button
				type="button"
				onClick={() => { setError(null); setStep(to); }}
				className="inline-flex items-center gap-1 text-sm text-base-content/50 hover:text-base-content/70"
			>
				<ArrowLeft className="w-4 h-4" /> Geri
			</button>
		);
	}

	const stepIndex = step === "choose" ? 0 : step === "profile" ? 1 : 2;

	return (
		<div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
			<div className="w-full max-w-md space-y-5">
				<div className="text-center">
					<h1 className="font-display text-2xl font-semibold text-base-content">Kagu&apos;ya hoş geldiniz</h1>
					<p className="text-sm text-base-content/60 mt-1">
						Ofisinizin ekibini kurun veya davet edildiğiniz bir ekibe katılın.
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
									i === stepIndex ? "w-6 bg-primary" : "w-1.5 bg-base-300",
								)}
							/>
						))}
					</div>
				)}

				{error && <Alert tone="error">{error}</Alert>}

				{!user ? (
					<Card className="text-center space-y-3">
						<p className="text-sm text-base-content/70">Devam etmek için giriş yapın veya hesap oluşturun.</p>
						<Button block onClick={() => setShowAuth(true)}>Giriş yap</Button>
					</Card>
				) : busy === "auto" ? (
					<Card className="text-center">
						<p className="text-sm text-base-content/70">Davetiniz kabul ediliyor…</p>
					</Card>
				) : step === "choose" ? (
					<div className="space-y-3">
						<button
							type="button"
							onClick={() => { setPath("create"); setStep("profile"); }}
							className="w-full text-left"
						>
							<Card className="space-y-1 hover:border-primary/40 border border-transparent transition-colors">
								<div className="font-display flex items-center gap-2 text-base-content font-semibold">
									<Building2 className="w-5 h-5 text-primary" /> Yeni ekip kur
								</div>
								<p className="text-xs text-base-content/60">
									Ekip sahibi olursunuz ve tüm ekibiniz için 14 günlük ücretsiz deneme başlar.
								</p>
							</Card>
						</button>
						<button
							type="button"
							onClick={() => { setPath("join"); setStep("profile"); }}
							className="w-full text-left"
						>
							<Card className="space-y-1 hover:border-primary/40 border border-transparent transition-colors">
								<div className="font-display flex items-center gap-2 text-base-content font-semibold">
									<UserPlus className="w-5 h-5 text-primary" /> Mevcut bir ekibe katıl
								</div>
								<p className="text-xs text-base-content/60">
									Size bir davet bağlantısı veya kodu mu gönderildi? Danışman olarak katılırsınız.
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
							<div className="font-display text-base-content font-semibold">Kendinizi tanıtın</div>
							<FormField label="Ad Soyad">
								<Input
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									placeholder="örn. Ayşe Yılmaz"
									required
									maxLength={80}
									autoFocus
								/>
							</FormField>
							<FormField label="Telefon (isteğe bağlı)">
								<PhoneInput
									value={phone}
									onChange={setPhone}
									placeholder="+90 5xx xxx xx xx"
									maxLength={30}
								/>
							</FormField>
							<Button type="submit" block disabled={!fullName.trim()}>Devam et</Button>
						</form>
					</Card>
				) : step === "team" ? (
					<Card>
						<form onSubmit={onCreate} className="space-y-4">
							{backBtn("profile")}
							<div className="font-display flex items-center gap-2 text-base-content font-semibold">
								<Building2 className="w-5 h-5 text-primary" /> Ekibinizi oluşturun
							</div>
							<FormField label="Ekip adı">
								<Input
									value={teamName}
									onChange={(e) => setTeamName(e.target.value)}
									placeholder="örn. Kagu Emlak"
									required
									maxLength={80}
									autoFocus
								/>
							</FormField>
							<FormField label="Kagu&apos;yu kaç kişi kullanacak?">
								<div className="grid grid-cols-4 gap-1 bg-base-200 rounded-xl p-1">
									{SIZE_BRACKETS.map((b) => (
										<button
											key={b.value}
											type="button"
											onClick={() => setSizeBracket(b.value)}
											className={cn(
												"h-9 text-sm font-medium rounded-lg transition-colors",
												sizeBracket === b.value
													? "bg-base-100 text-base-content shadow-soft"
													: "text-base-content/60 hover:text-base-content/80",
											)}
										>
											{b.label}
										</button>
									))}
								</div>
							</FormField>
							<div className="grid grid-cols-2 gap-3">
								<FormField label="Şehir">
									<Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="örn. İstanbul" maxLength={60} />
								</FormField>
								<FormField label="Ülke">
									<Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="örn. Türkiye" maxLength={60} />
								</FormField>
							</div>
							<FormField label="Bizi nereden duydunuz?">
								<Dropdown options={REFERRAL_SOURCES} value={referralSource} onChange={setReferralSource} />
							</FormField>
							<Button type="submit" block loading={busy === "create"} disabled={!teamName.trim()}>
								Ekibi oluştur ve ücretsiz denemeyi başlat
							</Button>
						</form>
					</Card>
				) : (
					<Card>
						<form onSubmit={onJoin} className="space-y-4">
							{backBtn("profile")}
							<div className="font-display flex items-center gap-2 text-base-content font-semibold">
								<UserPlus className="w-5 h-5 text-primary" /> Davet koduyla katıl
							</div>
							<FormField label="Davet kodu">
								<Input
									value={code}
									onChange={(e) => setCode(e.target.value)}
									placeholder="Davet kodunuzu yapıştırın"
									required
									autoFocus
								/>
							</FormField>
							<Button type="submit" block loading={busy === "join"} disabled={!code.trim()}>
								Ekibe katıl
							</Button>
						</form>
					</Card>
				)}

				{showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
			</div>
		</div>
	);
}
