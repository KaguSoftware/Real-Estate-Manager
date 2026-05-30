"use client";

/**
 * AdminPanel — manage user roles.
 *
 * The /admin server page enforces the access gate before mounting this component.
 * All Supabase calls go through the browser client; admin_set_user_role is a
 * SECURITY DEFINER RPC that re-checks is_admin() inside the function.
 */

import { useEffect, useState } from "react";
import { adminListUsers, adminSetUserRole } from "@/src/lib/db/profiles";
import type { ProfileRow, GlobalRole } from "@/src/lib/db/types";
import { AppShell, Card, CardLabel, Select, cn } from "@/src/components/ui";

export function AdminPanel() {
	const [users, setUsers] = useState<ProfileRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [updatingRole, setUpdatingRole] = useState<string | null>(null);
	const [roleError, setRoleError] = useState<string | null>(null);

	useEffect(() => {
		adminListUsers()
			.then(setUsers)
			.catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"))
			.finally(() => setLoading(false));
	}, []);

	async function handleRoleChange(userId: string, role: GlobalRole) {
		setUpdatingRole(userId);
		setRoleError(null);
		try {
			await adminSetUserRole({ userId, role });
			setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, app_role: role } : u)));
		} catch (e) {
			setRoleError(e instanceof Error ? e.message : "Failed to update role");
		} finally {
			setUpdatingRole(null);
		}
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
	}

	const headerCls = "text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400";

	return (
		<AppShell title="Admin · Users" subtitle="Change roles for any user">
			<Card padded={false}>
				<div className="px-4 sm:px-6 py-4 border-b border-slate-100">
					<CardLabel>All Users ({users.length})</CardLabel>
				</div>

				{loading ? (
					<div className="flex justify-center py-12">
						<span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
					</div>
				) : error ? (
					<p className="text-sm text-red-600 px-6 py-4">{error}</p>
				) : (
					<>
						{roleError && (
							<div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200">
								<p className="text-sm text-red-700">{roleError}</p>
							</div>
						)}
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-slate-100 bg-slate-50/60">
										<th className={headerCls}>Email</th>
										<th className={cn(headerCls, "hidden sm:table-cell")}>Name</th>
										<th className={headerCls}>Role</th>
										<th className={cn(headerCls, "hidden md:table-cell")}>Joined</th>
									</tr>
								</thead>
								<tbody>
									{users.map((user) => (
										<tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
											<td className="px-4 py-3 text-sm text-slate-700 max-w-50 truncate">{user.email}</td>
											<td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">{user.display_name ?? "—"}</td>
											<td className="px-4 py-3">
												<div className="flex items-center gap-2">
													<Select
														value={user.app_role}
														disabled={updatingRole === user.id}
														onChange={(e) => handleRoleChange(user.id, e.target.value as GlobalRole)}
														className="h-10 w-auto"
													>
														<option value="member">Member</option>
														<option value="admin">Admin</option>
														<option value="client">Client</option>
													</Select>
													{updatingRole === user.id && (
														<span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" />
													)}
												</div>
											</td>
											<td className="px-4 py-3 text-sm text-slate-400 hidden md:table-cell whitespace-nowrap">
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
