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
			toast.success("Role updated.");
		} catch (e) {
			setRoleError(humanizeError(e));
		} finally {
			setUpdatingRole(null);
		}
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
	}

	function roleSelect(user: ProfileRow) {
		return (
			<div className="flex items-center gap-2">
				<Select
					value={user.app_role}
					disabled={updatingRole === user.id}
					onChange={(e) => handleRoleChange(user.id, e.target.value as GlobalRole)}
					className="h-10 w-auto"
					aria-label={`Role for ${user.email}`}
				>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
					<option value="client">Client</option>
				</Select>
				{updatingRole === user.id && <Spinner size="sm" />}
			</div>
		);
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
						<Spinner size="sm" />
					</div>
				) : error ? (
					<Alert className="m-4 sm:m-6">{error}</Alert>
				) : (
					<>
						{roleError && <Alert className="mx-4 sm:mx-6 mt-4">{roleError}</Alert>}

						{/* Mobile: card list */}
						<ul className="block sm:hidden divide-y divide-slate-100">
							{users.map((user) => (
								<li key={user.id} className="p-4 space-y-2">
									<div className="min-w-0">
										<p className="text-sm font-semibold text-slate-800 truncate">{user.email}</p>
										<p className="text-xs text-slate-400 mt-0.5">
											{user.display_name ?? "—"} · joined {formatDate(user.created_at)}
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
									<tr className="border-b border-slate-100 bg-slate-50/60">
										<th className={headerCls}>Email</th>
										<th className={headerCls}>Name</th>
										<th className={headerCls}>Role</th>
										<th className={cn(headerCls, "hidden md:table-cell")}>Joined</th>
									</tr>
								</thead>
								<tbody>
									{users.map((user) => (
										<tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
											<td className="px-4 py-3 text-sm text-slate-700 max-w-50 truncate">{user.email}</td>
											<td className="px-4 py-3 text-sm text-slate-500">{user.display_name ?? "—"}</td>
											<td className="px-4 py-3">{roleSelect(user)}</td>
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
