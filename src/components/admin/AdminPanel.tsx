"use client";

/**
 * AdminPanel — manage user roles.
 *
 * The /admin server page enforces the access gate before mounting this component.
 * All Supabase calls go through the browser client; admin_set_user_role is a
 * SECURITY DEFINER RPC that re-checks is_admin() inside the function.
 */

import { humanizeError } from "@/src/lib/errors";
import { useEffect, useState } from "react";
import { adminListUsers, adminSetUserRole } from "@/src/lib/db/profiles";
import type { ProfileRow, GlobalRole } from "@/src/lib/db/types";
import { AppShell, Card, CardLabel, Select, Spinner, Alert, toast, cn } from "@/src/components/ui";

export function AdminPanel() {
	const [users, setUsers] = useState<ProfileRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [updatingRole, setUpdatingRole] = useState<string | null>(null);
	const [roleError, setRoleError] = useState<string | null>(null);

	useEffect(() => {
		adminListUsers()
			.then(setUsers)
			.catch((e) => setError(humanizeError(e)))
			.finally(() => setLoading(false));
	}, []);

	async function handleRoleChange(userId: string, role: GlobalRole) {
		setUpdatingRole(userId);
		setRoleError(null);
		try {
			await adminSetUserRole({ userId, role });
			setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, app_role: role } : u)));
			toast.success("Rol güncellendi.");
		} catch (e) {
			setRoleError(humanizeError(e));
		} finally {
			setUpdatingRole(null);
		}
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString("tr-TR", { month: "short", day: "numeric", year: "numeric" });
	}

	function roleSelect(user: ProfileRow) {
		return (
			<div className="flex items-center gap-2">
				<Select
					value={user.app_role}
					disabled={updatingRole === user.id}
					onChange={(e) => handleRoleChange(user.id, e.target.value as GlobalRole)}
					className="h-10 w-auto"
					aria-label={`${user.email} için rol`}
				>
					<option value="member">Üye</option>
					<option value="admin">Yönetici</option>
					<option value="client">Müşteri</option>
				</Select>
				{updatingRole === user.id && <Spinner size="sm" />}
			</div>
		);
	}

	const headerCls = "text-left px-4 py-3 text-xs font-semibold text-base-content/50";

	return (
		<AppShell title="Yönetim · Kullanıcılar" subtitle="Tüm kullanıcıların rollerini değiştirin">
			<Card padded={false}>
				<div className="px-4 sm:px-6 py-4 border-b border-base-300">
					<CardLabel>Tüm kullanıcılar ({users.length})</CardLabel>
				</div>

				{loading ? (
					<div className="flex justify-center py-12">
						<Spinner size="sm" />
					</div>
				) : error ? (
					<Alert className="m-4 sm:m-6">{error}</Alert>
				) : (
					<>
						{roleError && <Alert className="mx-4 sm:mx-6 mt-4">{roleError}</Alert>}

						{/* Mobile: card list */}
						<ul className="block sm:hidden divide-y divide-base-300">
							{users.map((user) => (
								<li key={user.id} className="p-4 space-y-2">
									<div className="min-w-0">
										<p className="text-sm font-semibold text-base-content truncate">{user.email}</p>
										<p className="text-xs text-base-content/50 mt-0.5">
											{user.display_name ?? "—"} · katılım {formatDate(user.created_at)}
										</p>
									</div>
									{roleSelect(user)}
								</li>
							))}
						</ul>

						{/* Desktop: table */}
						<div className="hidden sm:block overflow-x-auto">
							<table className="w-full min-w-140 text-sm">
								<thead>
									<tr className="border-b border-base-300 bg-base-200/60">
										<th className={headerCls}>E-posta</th>
										<th className={headerCls}>Ad</th>
										<th className={headerCls}>Rol</th>
										<th className={cn(headerCls, "hidden md:table-cell")}>Katılım</th>
									</tr>
								</thead>
								<tbody>
									{users.map((user) => (
										<tr key={user.id} className="border-b border-base-300 last:border-0 hover:bg-base-200 transition-colors">
											<td className="px-4 py-3 text-sm text-base-content/80 max-w-50 truncate">{user.email}</td>
											<td className="px-4 py-3 text-sm text-base-content/60">{user.display_name ?? "—"}</td>
											<td className="px-4 py-3">{roleSelect(user)}</td>
											<td className="px-4 py-3 text-sm text-base-content/50 hidden md:table-cell whitespace-nowrap">
												{formatDate(user.created_at)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</>
				)}
			</Card>
		</AppShell>
	);
}
