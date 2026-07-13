"use client";

/**
 * /auth/switch — account-conflict interstitial.
 *
 * Reached from /auth/callback when an invite/signup action link is opened while
 * a DIFFERENT account is already signed in. Auto-consuming the link there would
 * swap the live session to the invited identity and make the original account's
 * team look deleted (it isn't — see the callback route + proxy.ts). We stop and
 * let the user decide:
 *   - "Sign out & accept" → clear the current session, then replay the (still
 *     unconsumed) token at /auth/callback to join as the invited account.
 *   - "Stay signed in"    → keep the current session, go home.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { Button, Card, CardLabel, Alert, SpinnerBlock } from "@/src/components/ui";

function SwitchInner() {
	const router = useRouter();
	const params = useSearchParams();
	const [email, setEmail] = useState<string | null>(null);
	const [checking, setChecking] = useState(true);
	const [busy, setBusy] = useState(false);

	const tokenHash = params.get("token_hash");
	const type = params.get("type");
	const next = params.get("next");

	useEffect(() => {
		createClient().auth.getUser().then(({ data }) => {
			setEmail(data.user?.email ?? null);
			setChecking(false);
		});
	}, []);

	// Rebuild the callback URL with the untouched token so it can be consumed
	// after sign-out. Guarded: if the params are missing there is nothing to replay.
	function callbackUrl(): string | null {
		if (!tokenHash || !type) return null;
		const u = new URL("/auth/callback", window.location.origin);
		u.searchParams.set("token_hash", tokenHash);
		u.searchParams.set("type", type);
		if (next) u.searchParams.set("next", next);
		return `${u.pathname}${u.search}`;
	}

	async function acceptAsInvited() {
		const url = callbackUrl();
		if (!url) return;
		setBusy(true);
		await createClient().auth.signOut();
		// Full navigation (not router.push) so the new request carries no stale
		// session cookie and the callback verifies the token cleanly.
		window.location.assign(url);
	}

	return (
		<div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<Card className="space-y-3">
					<CardLabel>Hesap çakışması</CardLabel>
					{checking ? (
						<SpinnerBlock />
					) : !callbackUrl() ? (
						<div className="space-y-3">
							<Alert tone="error">
								Bu davet bağlantısı geçersiz veya eksik. Lütfen size gönderilen bağlantıyı yeniden açın.
							</Alert>
							<Button block variant="outline" onClick={() => router.replace("/")}>
								Ana sayfaya dön
							</Button>
						</div>
					) : (
						<>
							<p className="text-sm text-base-content/70">
								Şu anda{" "}
								<span className="font-semibold text-base-content">{email ?? "mevcut hesabınız"}</span>{" "}
								olarak giriş yaptınız. Bu davet bağlantısı farklı bir hesap içindir.
							</p>
							<p className="text-sm text-base-content/70">
								Daveti kabul etmek için önce bu hesaptan çıkış yapmanız gerekir. Mevcut hesabınız
								ve ekibiniz silinmez — yalnızca bu tarayıcıdaki oturumunuz kapanır.
							</p>
							<div className="flex flex-col gap-2 pt-1">
								<Button block loading={busy} onClick={acceptAsInvited}>
									Çıkış yap ve daveti kabul et
								</Button>
								<Button block variant="outline" disabled={busy} onClick={() => router.replace("/")}>
									Bu hesapta kal
								</Button>
							</div>
						</>
					)}
				</Card>
			</div>
		</div>
	);
}

export default function SwitchAccountPage() {
	// useSearchParams requires a Suspense boundary during prerender.
	return (
		<Suspense fallback={null}>
			<SwitchInner />
		</Suspense>
	);
}
