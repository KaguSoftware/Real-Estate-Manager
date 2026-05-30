"use client";

/**
 * AdminPanel — manage user roles.
 *
 * The /admin server page enforces the access gate before mounting this component.
 * All Supabase calls go through the browser client; admin_set_user_role is a
 * SECURITY DEFINER RPC that re-checks is_admin() inside the function.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminListUsers, adminSetUserRole } from "@/src/lib/db/profiles";
import type { ProfileRow, GlobalRole } from "@/src/lib/db/types";

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

	return (
		<div className="min-h-screen bg-slate-50 p-6 lg:p-10">
			<div className="max-w-4xl mx-auto">
				<div className="flex items-center justify-between mb-8">
					<div>
						<h1 className="text-xl font-bold text-slate-900">Admin · Users</h1>
						<p className="text-xs text-slate-500 mt-0.5">Change roles for any user in the system.</p>
					</div>
					<Link href="/" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
						← Back to dashboard
					</Link>
				</div>

				<div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
					<div className="px-6 py-4 border-b border-slate-100">
						<p className="text-xs font-black uppercase tracking-widest text-slate-400">
							All Users ({users.length})
						</p>
					</div>

					{loading ? (
						<div className="flex justify-center py-12">
							<span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
						</div>
					) : error ? (
						<p className="text-xs text-red-600 px-6 py-4">{error}</p>
					) : (
						<>
							{roleError && (
								<div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200">
									<p className="text-xs text-red-700">{roleError}</p>
								</div>
							)}
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-slate-100 bg-slate-50/50">
										<th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</th>
										<th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Name</th>
										<th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Role</th>
										<th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hidden md:table-cell">Joined</th>
									</tr>
								</thead>
								<tbody>
									{users.map((user) => (
										<tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
											<td className="px-6 py-3 text-xs text-slate-700 truncate max-w-[180px]">{user.email}</td>
											<td className="px-6 py-3 text-xs text-slate-500 hidden sm:table-cell">{user.display_name ?? "—"}</td>
											<td className="px-6 py-3">
												<select
													value={user.app_role}
													disabled={updatingRole === user.id}
													onChange={(e) => handleRoleChange(user.id, e.target.value as GlobalRole)}
													className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white ${
														user.app_role === "admin"
															? "border-amber-300 text-amber-700"
															: user.app_role === "client"
																? "border-blue-200 text-blue-700"
																: "border-slate-200 text-slate-700"
													} ${updatingRole === user.id ? "opacity-50" : ""}`}
												>
													<option value="member">Member</option>
													<option value="admin">Admin</option>
													<option value="client">Client</option>
												</select>
												{updatingRole === user.id && (
													<span className="ml-2 w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block align-middle" />
												)}
											</td>
											<td className="px-6 py-3 text-xs text-slate-400 hidden md:table-cell">
												{formatDate(user.created_at)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
