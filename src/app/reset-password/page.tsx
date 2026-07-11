"use client";

/**
 * /reset-password — final step of the "forgot password" flow. The recovery email
 * links to /auth/callback, which exchanges the code for a session and forwards
 * here, so by the time this page loads the user has a live (recovery) session and
 * can set a new password with supabase.auth.updateUser().
 *
 * If someone lands here without a session (link expired / opened directly), we
 * send them to /login to request a fresh link.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { humanizeError } from "@/src/lib/errors";
import { AppShell, Card, CardLabel, Button, FormField, Input, Alert, SpinnerBlock, toast } from "@/src/components/ui";

export default function ResetPasswordPage() {
	const router = useRouter();
	const [checking, setChecking] = useState(true);
	const [hasSession, setHasSession] = useState(false);
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [status, setStatus] = useState<"idle" | "loading">("idle");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const supabase = createClient();
		supabase.auth.getSession().then(({ data }) => {
			setHasSession(!!data.session);
			setChecking(false);
		});
	}, []);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (password.length < 8) { setError("Şifre en az 8 karakter olmalı."); return; }
		if (password !== confirm) { setError("Şifreler eşleşmiyor."); return; }
		setStatus("loading");
		const supabase = createClient();
		const { error: err } = await supabase.auth.updateUser({ password });
		if (err) { setError(humanizeError(err)); setStatus("idle"); return; }
		toast.success("Şifreniz güncellendi. Her şey hazır.");
		router.replace("/");
		router.refresh();
	}

	return (
		<AppShell title="Şifre sıfırlama" subtitle="Yeni bir şifre belirleyin">
			<div className="max-w-md">
				<Card>
					<CardLabel>Yeni şifre</CardLabel>
					{checking ? (
						<SpinnerBlock />
					) : !hasSession ? (
						<div className="mt-3 space-y-3">
							<Alert>Bu sıfırlama bağlantısının süresi dolmuş veya bağlantı daha önce kullanılmış.</Alert>
							<Button block variant="outline" onClick={() => router.replace("/login")}>
								Yeni bağlantı iste
							</Button>
						</div>
					) : (
						<form onSubmit={onSubmit} className="mt-3 space-y-4">
							<FormField label="Yeni şifre">
								<Input type="password" required autoFocus value={password}
									onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
							</FormField>
							<FormField label="Yeni şifre tekrarı">
								<Input type="password" required value={confirm}
									onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
							</FormField>
							{error && <Alert>{error}</Alert>}
							<Button type="submit" block loading={status === "loading"}>Şifreyi güncelle</Button>
						</form>
					)}
				</Card>
			</div>
		</AppShell>
	);
}
