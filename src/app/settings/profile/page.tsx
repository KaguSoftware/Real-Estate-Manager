"use client";

/**
 * /settings/profile — edit your own name/phone, change your password, and
 * delete your account (KVKK right-to-erasure). Profile fields reuse
 * getMyProfile / updateMyProfile (RLS: self-update only, app_role pinned by
 * 0013_profiles_role_guard.sql).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { useAppStore } from "@/src/store";
import { createClient } from "@/src/lib/supabase/client";
import { getAvatarUrl, getMyProfile, removeMyAvatar, updateMyProfile, uploadMyAvatar } from "@/src/lib/db/profiles";
import type { ProfileRow } from "@/src/lib/db/types";
import { AppShell, Card, CardLabel, Badge, Button, FormField, Input, PhoneInput, Alert, SpinnerBlock, ConfirmDialog, toast } from "@/src/components/ui";
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

	const avatarFileRef = useRef<HTMLInputElement>(null);
	const [avatarBusy, setAvatarBusy] = useState(false);

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

	async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ""; // allow re-selecting the same file
		if (!file) return;
		setError(null);
		setAvatarBusy(true);
		try {
			await uploadMyAvatar(file);
			setProfile(await getMyProfile());
			toast.success("Profil fotoğrafınız güncellendi.");
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setAvatarBusy(false);
		}
	}

	async function onRemoveAvatar() {
		if (!profile?.avatar_path) return;
		setError(null);
		setAvatarBusy(true);
		try {
			await removeMyAvatar(profile.avatar_path);
			setProfile(await getMyProfile());
			toast.success("Profil fotoğrafınız kaldırıldı.");
		} catch (err) {
			setError(humanizeError(err));
		} finally {
			setAvatarBusy(false);
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
	const displayName = (profile?.full_name ?? "").trim();
	const initial = (displayName || profile?.email || "?").charAt(0).toUpperCase();
	const avatarUrl = getAvatarUrl(profile?.avatar_path ?? null);

	return (
		<AppShell title="Profiliniz" subtitle={team?.name} width="3xl">
			{!loaded ? (
				<SpinnerBlock />
			) : (
				<div className="space-y-4 sm:space-y-5">
					{/* Identity header — who is signed in, at a glance. */}
					<Card className="flex items-center gap-4 sm:gap-5">
						<div
							aria-hidden
							className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full bg-primary text-primary-content ring-1 ring-primary/40 ring-offset-2 ring-offset-base-100 flex items-center justify-center font-display text-2xl font-semibold select-none overflow-hidden"
						>
							{avatarUrl ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img src={avatarUrl} alt="" className="h-full w-full object-cover" />
							) : (
								initial
							)}
						</div>
						<div className="min-w-0 flex-1">
							<p className="font-display text-xl sm:text-2xl font-semibold text-base-content truncate leading-tight">
								{displayName || "İsimsiz kullanıcı"}
							</p>
							<p className="text-sm text-base-content/60 truncate">{profile?.email}</p>
							<div className="mt-1.5 flex items-center gap-1">
								<input ref={avatarFileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPickAvatar} />
								<Button variant="ghost" size="sm" loading={avatarBusy} onClick={() => avatarFileRef.current?.click()}>
									<ImagePlus className="w-3.5 h-3.5" /> {avatarUrl ? "Fotoğrafı değiştir" : "Fotoğraf ekle"}
								</Button>
								{avatarUrl && !avatarBusy && (
									<Button variant="ghost" size="sm" onClick={onRemoveAvatar} aria-label="Profil fotoğrafını kaldır">
										<Trash2 className="w-3.5 h-3.5" />
									</Button>
								)}
							</div>
						</div>
						{team && (
							<Badge tone={isOwner ? "indigo" : "slate"} className="shrink-0">
								{isOwner ? "Ekip sahibi" : "Danışman"}
							</Badge>
						)}
					</Card>

					{error && <Alert tone="error">{error}</Alert>}

					<Card>
						<CardLabel>Hesap bilgileri</CardLabel>
						<form onSubmit={onSubmit} className="mt-4 space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<FormField label="Ad Soyad">
									<Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Adınız" autoComplete="name" />
								</FormField>
								<FormField label="Telefon">
									<PhoneInput value={phone} onChange={setPhone} placeholder="+90 5xx xxx xx xx" autoComplete="tel" />
								</FormField>
							</div>
							<div className="flex justify-end pt-1">
								<Button type="submit" loading={status === "loading"}>Kaydet</Button>
							</div>
						</form>
					</Card>

					<Card>
						<CardLabel>Şifre değiştir</CardLabel>
						<form onSubmit={onChangePassword} className="mt-4 space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<FormField label="Yeni şifre" hint="En az 8 karakter">
									<Input
										type="password"
										value={pw1}
										onChange={(e) => setPw1(e.target.value)}
										autoComplete="new-password"
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
							</div>
							{pwError && <Alert tone="error">{pwError}</Alert>}
							<div className="flex justify-end pt-1">
								<Button type="submit" variant="outline" loading={pwBusy} disabled={!pw1 && !pw2}>
									Şifreyi güncelle
								</Button>
							</div>
						</form>
					</Card>

					<Card className="border-error/30">
						<CardLabel className="text-error/90">Tehlikeli bölge</CardLabel>
						<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="text-sm font-semibold text-base-content">Hesabımı sil</p>
								<p className="mt-0.5 text-sm text-base-content/60">
									Hesabınızı kalıcı olarak siler. Bu işlem geri alınamaz.
									{isOwner && " Ekip sahibi olduğunuz için önce ekibi silmeniz veya sahipliği devretmeniz gerekir (Ekip sayfasından)."}
								</p>
							</div>
							<Button variant="danger" size="sm" className="shrink-0 self-start sm:self-center" onClick={() => setConfirmDelete(true)}>
								Hesabımı sil
							</Button>
						</div>
						{deleteError && <div className="mt-3"><Alert tone="error">{deleteError}</Alert></div>}
					</Card>
				</div>
			)}

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
