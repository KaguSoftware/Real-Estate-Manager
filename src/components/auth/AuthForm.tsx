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
import { fetchTeamContext } from "@/src/lib/db/teams";
import { useAppStore } from "@/src/store";
import { toast, Button, FormField, Input, Alert } from "@/src/components/ui";

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
	const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
	return `${base.replace(/\/$/, "")}/auth/callback`;
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
		if (team) toast.success("Welcome back!");
		router.replace(team ? (next || "/") : "/onboarding");
		router.refresh();
	}

	async function handleSignIn(e: React.FormEvent) {
		e.preventDefault();
		setStatus("loading");
		setErrorMsg("");
		const supabase = createClient();
		const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
		if (error) { setStatus("error"); setErrorMsg(humanizeError(error)); return; }
		setStatus("done");
		await routeAfterAuth();
	}

	async function handleMagicLink(e: React.FormEvent) {
		e.preventDefault();
		setStatus("loading");
		setErrorMsg("");
		const supabase = createClient();
		const { error } = await supabase.auth.signInWithOtp({
			email: email.trim(),
			options: { emailRedirectTo: authCallbackUrl() },
		});
		if (error) { setStatus("error"); setErrorMsg(humanizeError(error)); }
		else { setStatus("done"); setSuccessMsg(`Magic link sent to ${email.trim()}. Check your inbox.`); }
	}

	async function handleForgot(e: React.FormEvent) {
		e.preventDefault();
		setStatus("loading");
		setErrorMsg("");
		const supabase = createClient();
		// The recovery link lands on /auth/callback, which exchanges the code and
		// then forwards to /reset-password to set a new password.
		const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
			redirectTo: `${authCallbackUrl()}?next=/reset-password`,
		});
		if (error) { setStatus("error"); setErrorMsg(humanizeError(error)); }
		else { setStatus("done"); setSuccessMsg(`If an account exists for ${email.trim()}, a reset link is on its way.`); }
	}

	async function handleSignUp(e: React.FormEvent) {
		e.preventDefault();
		if (password !== confirmPassword) {
			setStatus("error");
			setErrorMsg("Passwords do not match.");
			return;
		}
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
		if (data.session) { setStatus("done"); await routeAfterAuth(); return; }
		setStatus("done");
		setSuccessMsg("Check your email to confirm your account. The link will drop you right into setup.");
	}

	const doneScreen = status === "done" && successMsg && (
		<div className="text-center space-y-3">
			<div className="text-4xl">✉️</div>
			<p className="text-slate-700 font-medium">{successMsg}</p>
			{onClose && <Button block variant="outline" onClick={onClose} className="mt-2">Done</Button>}
		</div>
	);

	return (
		<div className="space-y-4">
			{inviteTeam && (
				<div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-slate-700">
					You&apos;ve been invited to join <span className="font-semibold">{inviteTeam}</span>.
					{mode === "signup" ? " Create your account to accept." : " Sign in to accept."}
				</div>
			)}

			{doneScreen ? (
				doneScreen
			) : mode === "login" ? (
				signInMode === "password" ? (
					<form onSubmit={handleSignIn} className="space-y-4">
						<FormField label="Email address">
							<Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
						</FormField>
						<FormField label="Password">
							<Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
						</FormField>
						{status === "error" && <Alert>{errorMsg}</Alert>}
						<Button type="submit" block loading={status === "loading"}>Sign In</Button>
						<div className="text-center space-x-3">
							<button type="button" onClick={() => setSignInMode("magic")}
								className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
								Send magic link instead
							</button>
							<button type="button" onClick={() => { setSignInMode("forgot"); setStatus("idle"); setErrorMsg(""); }}
								className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
								Forgot password?
							</button>
						</div>
					</form>
				) : signInMode === "magic" ? (
					<form onSubmit={handleMagicLink} className="space-y-4">
						<p className="text-sm text-slate-500">
							Enter your email and we&apos;ll send you a sign-in link — no password needed.
						</p>
						<FormField label="Email address">
							<Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
						</FormField>
						{status === "error" && <Alert>{errorMsg}</Alert>}
						<Button type="submit" block loading={status === "loading"}>Send magic link</Button>
						<div className="text-center">
							<button type="button" onClick={() => setSignInMode("password")}
								className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
								Back to password sign in
							</button>
						</div>
					</form>
				) : (
					<form onSubmit={handleForgot} className="space-y-4">
						<p className="text-sm text-slate-500">
							Enter your email and we&apos;ll send you a link to reset your password.
						</p>
						<FormField label="Email address">
							<Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
						</FormField>
						{status === "error" && <Alert>{errorMsg}</Alert>}
						<Button type="submit" block loading={status === "loading"}>Send reset link</Button>
						<div className="text-center">
							<button type="button" onClick={() => setSignInMode("password")}
								className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
								Back to password sign in
							</button>
						</div>
					</form>
				)
			) : (
				<form onSubmit={handleSignUp} className="space-y-4">
					<FormField label="Email address">
						<Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
					</FormField>
					<FormField label="Password">
						<Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
					</FormField>
					<FormField label="Confirm password">
						<Input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
					</FormField>
					{status === "error" && <Alert>{errorMsg}</Alert>}
					<Button type="submit" block loading={status === "loading"}>Create Account</Button>
				</form>
			)}

			{standalone && !doneScreen && (
				<p className="text-center text-sm text-slate-500">
					{mode === "login" ? (
						<>New to Kagu?{" "}
							<Link href="/signup" className="text-primary font-medium hover:underline">Create an account</Link>
						</>
					) : (
						<>Already have an account?{" "}
							<Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
						</>
					)}
				</p>
			)}
		</div>
	);
}
