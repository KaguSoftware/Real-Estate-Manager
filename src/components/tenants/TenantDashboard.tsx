"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/src/store";
import { listTenants } from "@/src/lib/db/tenants";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { AppShell, Card, Button, Alert, Input } from "@/src/components/ui";
import { TenantTable } from "./TenantTable";
import { TenantForm } from "./TenantForm";
import type { Tenant } from "@/src/lib/db/types";
import { downloadCsv } from "@/src/lib/csv";
import { Plus, Search, Download } from "lucide-react";

export function TenantDashboard() {
	const user = useAppStore((s) => s.user);
	const [q, setQ] = useState("");
	// Debounced copy of q drives the query so we don't refetch per keystroke.
	const [debouncedQ, setDebouncedQ] = useState("");
	// Open the create-tenant form when arriving via the global Add menu (/tenants?new=1),
	// mirroring the LeadDashboard pattern: read once at mount, then strip the flag.
	const router = useRouter();
	const searchParams = useSearchParams();
	const openNew = searchParams.get("new") === "1";
	const [editing, setEditing] = useState<
		{ mode: "create" } | { mode: "edit"; tenant: Tenant } | null
	>(() => (openNew ? { mode: "create" } : null));

	useEffect(() => {
		if (openNew) router.replace("/tenants");
	}, [openNew, router]);

	const debounceTimer = useRef<number | undefined>(undefined);
	function onSearchChange(value: string) {
		setQ(value);
		window.clearTimeout(debounceTimer.current);
		debounceTimer.current = window.setTimeout(() => setDebouncedQ(value), 300);
	}

	const cacheKey = user ? `tenants:${JSON.stringify({ q: debouncedQ })}` : null;
	const { data, loading, error, refetch } = useCachedResource(
		cacheKey,
		() => listTenants({ q: debouncedQ || undefined }),
		undefined,
		{ enabled: !!user },
	);
	const tenants = data ?? [];

	return (
		<AppShell title="Tenants" subtitle="Renters, buyers & guarantors" width="7xl">
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-sm text-slate-600">Sign in to manage tenants.</p>
					<p className="text-xs text-slate-400 mt-1">Use the Sign in button in the top bar.</p>
				</Card>
			) : (
				<>
					<div className="mb-4 flex items-center gap-2">
						<div className="relative flex-1 max-w-md">
							<Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
							<Input
								value={q}
								onChange={(e) => onSearchChange(e.target.value)}
								placeholder="Search name, phone or email…"
								className="pl-10"
								aria-label="Search tenants"
							/>
						</div>
						<Button
							variant="outline"
							className="hidden sm:inline-flex"
							onClick={() =>
								downloadCsv(
									"tenants",
									["Name", "Phone", "Email", "National ID", "Notes", "Added"],
									tenants.map((t) => [t.full_name, t.phone, t.email, t.national_id, t.notes, t.created_at?.slice(0, 10)]),
								)
							}
						>
							<Download className="w-4 h-4" />
							CSV
						</Button>
						<Button className="hidden sm:inline-flex" onClick={() => setEditing({ mode: "create" })}>
							<Plus className="w-4 h-4" />
							Add tenant
						</Button>
					</div>

					{error && <Alert className="mb-4">{error}</Alert>}

					<TenantTable
						tenants={tenants}
						loading={loading}
						onEdit={(tenant) => setEditing({ mode: "edit", tenant })}
					/>

					<button
						onClick={() => setEditing({ mode: "create" })}
						aria-label="Add tenant"
						className="sm:hidden fixed right-4 bottom-4 z-20 h-14 w-14 rounded-full bg-primary text-primary-content shadow-pop flex items-center justify-center active:brightness-95 safe-bottom"
					>
						<Plus className="w-6 h-6" />
					</button>
				</>
			)}

			{editing && (
				<TenantForm
					mode={editing.mode}
					initial={editing.mode === "edit" ? editing.tenant : undefined}
					onClose={() => setEditing(null)}
					onDone={() => { setEditing(null); refetch(); }}
				/>
			)}
		</AppShell>
	);
}
