"use client";

/**
 * /settings/profile — edit your own name/phone, change your password, and
 * delete your account (KVKK right-to-erasure). Profile fields reuse
 * getMyProfile / updateMyProfile (RLS: self-update only, app_role pinned by
 * 0013_profiles_role_guard.sql).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { createClient } from "@/src/lib/supabase/client";
import { getMyProfile, updateMyProfile } from "@/src/lib/db/profiles";
import type { ProfileRow } from "@/src/lib/db/types";
import { AppShell, Card, CardLabel, Button, FormField, Input, Alert, SpinnerBlock, ConfirmDialog, toast } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

export default function ProfileSettingsPage() {
	const team = useAppStore((s) => s.team);
	const router = useRouter();
	const [profile, setProfile] = useState<ProfileRow | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [fullName, setFullName] = useState("");
	const [phone, setPhone] = useState("");
	const [status, setStatus] = useState<"idle" | "loading">("idle");
	const [error, setError] = useState<string | null>(null);

	const [pw1, setPw1] = useState("");
	const [pw2, setPw2] = useState("");
	const [pwBusy, setPwBusy] = useState(false);
	const [pwError, setPwError] = useState<string | null>(null);

	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

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
			toast.success("Profiliniz güncellendi.");
			setProfile(await getMyProfile());
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setStatus("idle");
		}
	}

	async function onChangePassword(e: React.FormEvent) {
		e.preventDefault();
		setPwError(null);
		if (pw1.length < 8) {
			setPwError("Şifre en az 8 karakter olmalı.");
			return;
		}
		if (pw1 !== pw2) {
			setPwError("Şifreler eşleşmiyor.");
			return;
		}
		setPwBusy(true);
		try {
			const { error: err } = await createClient().auth.updateUser({ password: pw1 });
			if (err) throw err;
			setPw1("");
			setPw2("");
			toast.success("Şifreniz değiştirildi.");
		} catch (err) {
			setPwError(humanizeError(err));
		} finally {
			setPwBusy(false);
		}
	}

	async function onDeleteAccount() {
		setDeleteError(null);
		setDeleting(true);
		try {
			const res = await fetch("/api/account/delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ confirmation: "DELETE" }),
			});
			const json = (await res.json()) as { ok?: boolean; error?: string };
			if (!res.ok) throw new Error(json.error || "Hesap silinemedi");
			await createClient().auth.signOut();
			router.replace("/");
		} catch (err) {
			setDeleteError(humanizeError(err));
			setConfirmDelete(false);
		} finally {
			setDeleting(false);
		}
	}

	const isOwner = team?.role === "owner";

	return (
		<AppShell title="Profiliniz" subtitle={team?.name}>
			<div className="max-w-md space-y-4">
				<Card>
					<CardLabel>Hesap</CardLabel>
					{!loaded ? (
						<SpinnerBlock />
					) : (
						<form onSubmit={onSubmit} className="mt-3 space-y-4">
							<FormField label="E-posta">
								<Input type="email" value={profile?.email ?? ""} disabled readOnly />
							</FormField>
							<FormField label="Ad Soyad">
								<Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Adınız" />
							</FormField>
							<FormField label="Telefon">
								<Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" />
							</FormField>
							{error && <Alert tone="error">{error}</Alert>}
							<Button type="submit" loading={status === "loading"}>Kaydet</Button>
						</form>
					)}
				</Card>

				<Card>
					<CardLabel>Şifre değiştir</CardLabel>
					<form onSubmit={onChangePassword} className="mt-3 space-y-4">
						<FormField label="Yeni şifre">
							<Input
								type="password"
								value={pw1}
								onChange={(e) => setPw1(e.target.value)}
								autoComplete="new-password"
								placeholder="En az 8 karakter"
							/>
						</FormField>
						<FormField label="Yeni şifre (tekrar)">
							<Input
								type="password"
								value={pw2}
								onChange={(e) => setPw2(e.target.value)}
								autoComplete="new-password"
							/>
						</FormField>
						{pwError && <Alert tone="error">{pwError}</Alert>}
						<Button type="submit" variant="outline" loading={pwBusy} disabled={!pw1 && !pw2}>
							Şifreyi güncelle
						</Button>
					</form>
				</Card>

				<Card>
					<CardLabel>Tehlikeli bölge</CardLabel>
					<p className="mt-2 text-sm text-base-content/70">
						Hesabınızı kalıcı olarak siler. Bu işlem geri alınamaz.
						{isOwner && " Ekip sahibi olduğunuz için önce ekibi silmeniz veya sahipliği devretmeniz gerekir (Ekip sayfasından)."}
					</p>
					{deleteError && <div className="mt-3"><Alert tone="error">{deleteError}</Alert></div>}
					<Button
						variant="outline"
						size="sm"
						className="mt-3 text-error border-error/40 hover:bg-error/10"
						onClick={() => setConfirmDelete(true)}
					>
						Hesabımı sil
					</Button>
				</Card>
			</div>

			<ConfirmDialog
				open={confirmDelete}
				title="Hesabınız silinsin mi?"
				message="Hesabınız ve profiliniz kalıcı olarak silinir. Bu işlem geri alınamaz."
				confirmLabel="Hesabımı kalıcı olarak sil"
				cancelLabel="Vazgeç"
				loading={deleting}
				onConfirm={onDeleteAccount}
				onCancel={() => setConfirmDelete(false)}
			/>
		</AppShell>
	);
}
