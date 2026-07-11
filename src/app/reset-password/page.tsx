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
		if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
		if (password !== confirm) { setError("Passwords do not match."); return; }
		setStatus("loading");
		const supabase = createClient();
		const { error: err } = await supabase.auth.updateUser({ password });
		if (err) { setError(humanizeError(err)); setStatus("idle"); return; }
		toast.success("Password updated. You're all set.");
		router.replace("/");
		router.refresh();
	}

	return (
		<AppShell title="Reset password" subtitle="Choose a new password">
			<div className="max-w-md">
				<Card>
					<CardLabel>New password</CardLabel>
					{checking ? (
						<SpinnerBlock />
					) : !hasSession ? (
						<div className="mt-3 space-y-3">
							<Alert>This reset link has expired or was already used.</Alert>
							<Button block variant="outline" onClick={() => router.replace("/login")}>
								Request a new link
							</Button>
						</div>
					) : (
						<form onSubmit={onSubmit} className="mt-3 space-y-4">
							<FormField label="New password">
								<Input type="password" required autoFocus value={password}
									onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
							</FormField>
							<FormField label="Confirm new password">
								<Input type="password" required value={confirm}
									onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
							</FormField>
							{error && <Alert>{error}</Alert>}
							<Button type="submit" block loading={status === "loading"}>Update password</Button>
						</form>
					)}
				</Card>
			</div>
		</AppShell>
	);
}
