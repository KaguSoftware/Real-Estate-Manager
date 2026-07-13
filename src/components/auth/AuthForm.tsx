"use client";

/**
 * AuthForm — the shared credentials form behind /login, /signup and the
 * in-app AuthModal. After a successful password sign-in it routes the user
 * immediately (no team → /onboarding, otherwise ?next= or /), which fixes
 * the old "onboarding only appears after a refresh" behavior where the
 * middleware redirect never fired because the modal closed without navigating.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { humanizeError } from "@/src/lib/errors";
import { createClient } from "@/src/lib/supabase/client";
import { getSiteUrl } from "@/src/lib/siteUrl";
import { fetchTeamContext } from "@/src/lib/db/teams";
import { useAppStore } from "@/src/store";
import { toast, Button, FormField, Input, EmailInput, Alert } from "@/src/components/ui";
import { validEmail } from "@/src/lib/validation";

export type AuthMode = "login" | "signup";
type SignInMode = "password" | "magic" | "forgot";

// Must match the cookie set by /join/[code]/route.ts
export const PENDING_INVITE_COOKIE = "kagu_pending_invite";

export function readPendingInvite(): string | null {
	if (typeof document === "undefined") return null;
	const m = document.cookie.match(new RegExp(`(?:^|; )${PENDING_INVITE_COOKIE}=([^;]*)`));
	return m ? decodeURIComponent(m[1]) : null;
}

// Email links should always point at the deployed app, even when the sign-up
// happens from a dev session; falls back to the current origin locally.
function authCallbackUrl() {
	return `${getSiteUrl(window.location.origin)}/auth/callback`;
}

interface AuthFormProps {
	mode: AuthMode;
	/** Destination after sign-in when the user already has a team. */
	next?: string;
	/** Rendered inside page routes (shows cross-links); false inside the modal. */
	standalone?: boolean;
	/** Modal-only: called after auth succeeds or the user dismisses. */
	onClose?: () => void;
}

export function AuthForm({ mode, next, standalone = true, onClose }: AuthFormProps) {
	const router = useRouter();
	const setTeam = useAppStore((s) => s.setTeam);

	const [signInMode, setSignInMode] = useState<SignInMode>("password");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [acceptedTerms, setAcceptedTerms] = useState(false);
	const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
	const [errorMsg, setErrorMsg] = useState("");
	const [successMsg, setSuccessMsg] = useState("");
	const [inviteTeam, setInviteTeam] = useState<string | null>(null);

	// "You've been invited to join <Team>" banner when arriving via /join/[code].
	useEffect(() => {
		const code = readPendingInvite();
		if (!code) return;
		const supabase = createClient();
		supabase
			.rpc("invite_team_name", { invite_code: code })
			.then(({ data }) => { if (data) setInviteTeam(data as string); });
	}, []);

	/** Route the freshly signed-in user without waiting for a refresh. */
	async function routeAfterAuth() {
		let team = null;
		try {
			team = await fetchTeamContext();
		} catch {
			// fall through — treat as team-less; /onboarding sorts it out
		}
		setTeam(team);
		onClose?.();
		if (team) toast.success("Tekrar hoş geldiniz!");
		router.replace(team ? (next || "/") : "/onboarding");
		router.refresh();
	}

	/** Submit gate shared by all four flows: block on malformed addresses. */
	function emailGate(): boolean {
		const err = validEmail(email);
		if (err) { setStatus("error"); setErrorMsg(err); return false; }
		return true;
	}

	async function handleSignIn(e: React.FormEvent) {
		e.preventDefault();
		if (!emailGate()) return;
		setStatus("loading");
		setErrorMsg("");
		const supabase = createClient();
		const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
		if (error) { setStatus("error"); setErrorMsg(humanizeError(error)); return; }
		// Stay in "loading" until navigation lands — flipping to "done" here
		// stopped the spinner seconds before the app actually opened.
		await routeAfterAuth();
	}

	async function handleMagicLink(e: React.FormEvent) {
		e.preventDefault();
		if (!emailGate()) return;
		setStatus("loading");
		setErrorMsg("");
		const supabase = createClient();
		// shouldCreateUser:false — the login form must sign in, not silently
		// register whatever address was typed (spam/enumeration surface).
		const { error } = await supabase.auth.signInWithOtp({
			email: email.trim(),
			options: { emailRedirectTo: authCallbackUrl(), shouldCreateUser: false },
		});
		if (error) { setStatus("error"); setErrorMsg(humanizeError(error)); }
		else { setStatus("done"); setSuccessMsg(`Giriş bağlantısı ${email.trim()} adresine gönderildi. Gelen kutunuzu kontrol edin.`); }
	}

	async function handleForgot(e: React.FormEvent) {
		e.preventDefault();
		if (!emailGate()) return;
		setStatus("loading");
		setErrorMsg("");
		const supabase = createClient();
		// The recovery link lands on /auth/callback, which exchanges the code and
		// then forwards to /reset-password to set a new password.
		const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
			redirectTo: `${authCallbackUrl()}?next=/reset-password`,
		});
		if (error) { setStatus("error"); setErrorMsg(humanizeError(error)); }
		else { setStatus("done"); setSuccessMsg(`${email.trim()} adresine ait bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.`); }
	}

	async function handleSignUp(e: React.FormEvent) {
		e.preventDefault();
		if (!acceptedTerms) {
			setStatus("error");
			setErrorMsg("Devam etmek için Kullanım Koşulları'nı ve KVKK Aydınlatma Metni'ni kabul etmelisiniz.");
			return;
		}
		if (password.length < 8) {
			setStatus("error");
			setErrorMsg("Şifre en az 8 karakter olmalı.");
			return;
		}
		if (password !== confirmPassword) {
			setStatus("error");
			setErrorMsg("Şifreler eşleşmiyor.");
			return;
		}
		if (!emailGate()) return;
		setStatus("loading");
		setErrorMsg("");
		const supabase = createClient();
		const { data, error } = await supabase.auth.signUp({
			email: email.trim(),
			password,
			options: { emailRedirectTo: authCallbackUrl() },
		});
		if (error) { setStatus("error"); setErrorMsg(humanizeError(error)); return; }
		// When email confirmation is disabled, Supabase returns a live session —
		// route straight into onboarding instead of asking them to check email.
		if (data.session) { await routeAfterAuth(); return; } // spinner stays on until nav
		setStatus("done");
		setSuccessMsg("Hesabınızı doğrulamak için e-postanızı kontrol edin. Bağlantı sizi doğrudan kuruluma yönlendirecek.");
	}

	const doneScreen = status === "done" && successMsg && (
		<div className="text-center space-y-3">
			<div className="text-4xl">✉️</div>
			<p className="text-base-content/80 font-medium">{successMsg}</p>
			{onClose && <Button block variant="outline" onClick={onClose} className="mt-2">Tamam</Button>}
		</div>
	);

	return (
		<div className="space-y-4">
			{inviteTeam && (
				<div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-base-content/80">
					<span className="font-semibold">{inviteTeam}</span> ekibine katılmaya davet edildiniz.
					{mode === "signup" ? " Kabul etmek için hesabınızı oluşturun." : " Kabul etmek için giriş yapın."}
				</div>
			)}

			{doneScreen ? (
				doneScreen
			) : mode === "login" ? (
				signInMode === "password" ? (
					<form onSubmit={handleSignIn} className="space-y-4">
						<FormField label="E-posta adresi">
							<EmailInput required autoFocus value={email} onChange={setEmail} placeholder="ornek@eposta.com" />
						</FormField>
						<FormField label="Şifre">
							<Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
						</FormField>
						{status === "error" && <Alert>{errorMsg}</Alert>}
						<Button type="submit" block loading={status === "loading"}>Giriş yap</Button>
						<div className="text-center space-x-3">
							<button type="button" onClick={() => setSignInMode("magic")}
								className="text-sm text-base-content/50 hover:text-base-content/70 underline underline-offset-2">
								Giriş bağlantısı gönder
							</button>
							<button type="button" onClick={() => { setSignInMode("forgot"); setStatus("idle"); setErrorMsg(""); }}
								className="text-sm text-base-content/50 hover:text-base-content/70 underline underline-offset-2">
								Şifrenizi mi unuttunuz?
							</button>
						</div>
					</form>
				) : signInMode === "magic" ? (
					<form onSubmit={handleMagicLink} className="space-y-4">
						<p className="text-sm text-base-content/60">
							E-posta adresinizi girin, size bir giriş bağlantısı gönderelim — şifre gerekmez.
						</p>
						<FormField label="E-posta adresi">
							<EmailInput required autoFocus value={email} onChange={setEmail} placeholder="ornek@eposta.com" />
						</FormField>
						{status === "error" && <Alert>{errorMsg}</Alert>}
						<Button type="submit" block loading={status === "loading"}>Giriş bağlantısı gönder</Button>
						<div className="text-center">
							<button type="button" onClick={() => setSignInMode("password")}
								className="text-sm text-base-content/50 hover:text-base-content/70 underline underline-offset-2">
								Şifreyle girişe dön
							</button>
						</div>
					</form>
				) : (
					<form onSubmit={handleForgot} className="space-y-4">
						<p className="text-sm text-base-content/60">
							E-posta adresinizi girin, şifrenizi sıfırlamanız için size bir bağlantı gönderelim.
						</p>
						<FormField label="E-posta adresi">
							<EmailInput required autoFocus value={email} onChange={setEmail} placeholder="ornek@eposta.com" />
						</FormField>
						{status === "error" && <Alert>{errorMsg}</Alert>}
						<Button type="submit" block loading={status === "loading"}>Sıfırlama bağlantısı gönder</Button>
						<div className="text-center">
							<button type="button" onClick={() => setSignInMode("password")}
								className="text-sm text-base-content/50 hover:text-base-content/70 underline underline-offset-2">
								Şifreyle girişe dön
							</button>
						</div>
					</form>
				)
			) : (
				<form onSubmit={handleSignUp} className="space-y-4">
					<FormField label="E-posta adresi">
						<EmailInput required autoFocus value={email} onChange={setEmail} placeholder="ornek@eposta.com" />
					</FormField>
					<FormField label="Şifre">
						<Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
					</FormField>
					<FormField label="Şifre tekrarı">
						<Input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
					</FormField>
					<label className="flex items-start gap-2.5 text-sm text-base-content/70 cursor-pointer">
						<input
							type="checkbox"
							checked={acceptedTerms}
							onChange={(e) => setAcceptedTerms(e.target.checked)}
							className="checkbox checkbox-sm checkbox-primary mt-0.5 shrink-0"
						/>
						<span>
							<Link href="/kullanim-kosullari" target="_blank" className="underline hover:text-base-content">Kullanım Koşulları</Link>&apos;nı
							ve <Link href="/kvkk-aydinlatma" target="_blank" className="underline hover:text-base-content">KVKK Aydınlatma Metni</Link>&apos;ni
							okudum, kabul ediyorum.
						</span>
					</label>
					{status === "error" && <Alert>{errorMsg}</Alert>}
					<Button type="submit" block loading={status === "loading"}>Hesap oluştur</Button>
				</form>
			)}

			{standalone && !doneScreen && (
				<p className="text-center text-sm text-base-content/60">
					{mode === "login" ? (
						<>Kagu&apos;da yeni misiniz?{" "}
							<Link href="/signup" className="text-primary font-medium hover:underline">Hesap oluşturun</Link>
						</>
					) : (
						<>Zaten hesabınız var mı?{" "}
							<Link href="/login" className="text-primary font-medium hover:underline">Giriş yapın</Link>
						</>
					)}
				</p>
			)}
		</div>
	);
}
