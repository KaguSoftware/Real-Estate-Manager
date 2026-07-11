"use client";

/**
 * /settings/profile — edit your own name and phone. These fields (profiles.full_name,
 * profiles.phone) were previously only settable during onboarding. Reuses
 * getMyProfile / updateMyProfile (RLS: self-update only, guarded so app_role can't
 * be changed here — see 0013_profiles_role_guard.sql).
 */

import { useEffect, useState } from "react";
import { useAppStore } from "@/src/store";
import { getMyProfile, updateMyProfile } from "@/src/lib/db/profiles";
import type { ProfileRow } from "@/src/lib/db/types";
import { AppShell, Card, CardLabel, Button, FormField, Input, Alert, SpinnerBlock, toast } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

export default function ProfileSettingsPage() {
	const team = useAppStore((s) => s.team);
	const [profile, setProfile] = useState<ProfileRow | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [fullName, setFullName] = useState("");
	const [phone, setPhone] = useState("");
	const [status, setStatus] = useState<"idle" | "loading">("idle");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		getMyProfile()
			.then((p) => {
				setProfile(p);
				setFullName(p?.full_name ?? "");
				setPhone(p?.phone ?? "");
			})
			.finally(() => setLoaded(true));
	}, []);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setStatus("loading");
		try {
			await updateMyProfile({ fullName, phone });
			toast.success("Profile updated.");
			setProfile(await getMyProfile());
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setStatus("idle");
		}
	}

	return (
		<AppShell title="Your profile" subtitle={team?.name}>
			<div className="max-w-md space-y-4">
				<Card>
					<CardLabel>Account</CardLabel>
					{!loaded ? (
						<SpinnerBlock />
					) : (
						<form onSubmit={onSubmit} className="mt-3 space-y-4">
							<FormField label="Email">
								<Input type="email" value={profile?.email ?? ""} disabled readOnly />
							</FormField>
							<FormField label="Full name">
								<Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
							</FormField>
							<FormField label="Phone">
								<Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" />
							</FormField>
							{error && <Alert tone="error">{error}</Alert>}
							<Button type="submit" loading={status === "loading"}>Save changes</Button>
						</form>
					)}
				</Card>
			</div>
		</AppShell>
	);
}
