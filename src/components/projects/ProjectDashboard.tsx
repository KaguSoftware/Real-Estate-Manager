"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, useTeamReady, useIsWritable } from "@/src/store";
import { listProjects } from "@/src/lib/db/projects";
import { useCachedResource } from "@/src/lib/useCachedResource";
import {
	AppShell, Card, Alert, Button, Input, Dropdown, EmptyState, SpinnerBlock,
	Badge, type DropdownOption,
} from "@/src/components/ui";
import { ProjectForm } from "./ProjectForm";
import type { Project } from "@/src/lib/db/types";
import { Plus, Search, Building2, ExternalLink } from "lucide-react";

type Editing = { mode: "create" } | { mode: "edit"; project: Project } | null;

const ALL = "all";

function fmtPrice(p: number | null, ccy: string): string | null {
	if (p == null) return null;
	return `${Math.round(p).toLocaleString("tr-TR")} ${ccy}`;
}

/**
 * Projeler — construction-company projects. This is the inventory that never
 * reaches public portals: the agency's edge. Each card is mostly a pointer to
 * the developer's Drive folder, so the Drive link is surfaced on the card
 * itself rather than only on the detail page.
 */
export function ProjectDashboard() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const isWritable = useIsWritable();
	const projects = useAppStore((s) => s.projects);
	const setProjects = useAppStore((s) => s.setProjects);
	const setIsLoadingProjects = useAppStore((s) => s.setIsLoadingProjects);

	const [q, setQ] = useState("");
	const [debouncedQ, setDebouncedQ] = useState("");
	const [developer, setDeveloper] = useState<string>(ALL);
	const debounceTimer = useRef<number | undefined>(undefined);

	// Open the create sheet when arriving via the global Add menu, then strip
	// the flag so refresh/back doesn't reopen it.
	const newFlag = searchParams.get("new");
	const [editing, setEditing] = useState<Editing>(() => (newFlag ? { mode: "create" } : null));
	useEffect(() => {
		if (newFlag) router.replace("/projects");
	}, [newFlag, router]);

	function onSearchChange(value: string) {
		setQ(value);
		window.clearTimeout(debounceTimer.current);
		debounceTimer.current = window.setTimeout(() => setDebouncedQ(value), 300);
	}

	const query = useMemo(() => ({ q: debouncedQ || undefined }), [debouncedQ]);
	const cacheKey = user && teamReady ? `projects:${JSON.stringify(query)}` : null;

	const { loading, error, refetch } = useCachedResource(
		cacheKey,
		() => listProjects(query),
		setProjects,
		{ enabled: !!user && teamReady },
	);

	useEffect(() => {
		setIsLoadingProjects(loading);
	}, [loading, setIsLoadingProjects]);

	// Developer options come from the loaded rows, so the list self-populates.
	const developerOptions = useMemo<DropdownOption<string>[]>(() => {
		const set = new Set<string>();
		for (const p of projects) {
			const d = p.developer_name?.trim();
			if (d) set.add(d);
		}
		return [
			{ value: ALL, label: "Tüm firmalar" },
			...[...set].sort((a, b) => a.localeCompare(b, "tr")).map((d) => ({ value: d, label: d })),
		];
	}, [projects]);

	const visible = useMemo(
		() => (developer === ALL ? projects : projects.filter((p) => p.developer_name === developer)),
		[projects, developer],
	);

	return (
		<AppShell title="Projeler">
			<div className="flex gap-2 items-center mb-4">
				<div className="relative flex-1 min-w-0">
					<Search className="w-4 h-4 text-base-content/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
					<Input
						placeholder="Proje, firma veya konum ara…"
						value={q}
						onChange={(e) => onSearchChange(e.target.value)}
						className="pl-9"
					/>
				</div>
				{developerOptions.length > 1 && (
					<Dropdown
						options={developerOptions}
						value={developer}
						onChange={setDeveloper}
						className="shrink-0 basis-44"
						aria-label="Müteahhit firma"
					/>
				)}
				{isWritable && (
					<Button onClick={() => setEditing({ mode: "create" })} className="shrink-0">
						<Plus className="w-4 h-4" />
						<span className="hidden sm:inline">Proje ekle</span>
					</Button>
				)}
			</div>

			{error && <Alert>{error}</Alert>}

			{loading && projects.length === 0 ? (
				<SpinnerBlock />
			) : visible.length === 0 ? (
				<EmptyState
					icon={Building2}
					title={q || developer !== ALL ? "Sonuç bulunamadı" : "Henüz proje yok"}
					hint={
						q || developer !== ALL
							? "Aramanızı veya firma filtresini değiştirmeyi deneyin."
							: "Müteahhit firmaların paylaştığı projeleri buraya ekleyin — katalog ve görsellerin bulunduğu Drive bağlantısıyla birlikte."
					}
					action={
						isWritable && !q && developer === ALL ? (
							<Button onClick={() => setEditing({ mode: "create" })}>
								<Plus className="w-4 h-4" />
								Proje ekle
							</Button>
						) : undefined
					}
				/>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{visible.map((p) => {
						const price = fmtPrice(p.price_from, p.price_currency);
						return (
							<Card
								key={p.id}
								className="p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/40 transition-colors"
								onClick={() => router.push(`/projects/${p.id}`)}
							>
								<div className="min-w-0">
									<p className="font-semibold truncate">{p.name}</p>
									{p.developer_name && (
										<p className="text-sm text-base-content/60 truncate">{p.developer_name}</p>
									)}
								</div>

								<div className="flex flex-wrap items-center gap-2 text-sm">
									{price && <Badge tone="slate">{price}&nbsp;başlangıç</Badge>}
									{[p.mahalle, p.city].filter(Boolean).length > 0 && (
										<span className="text-base-content/60 truncate">
											{[p.mahalle, p.city].filter(Boolean).join(", ")}
										</span>
									)}
								</div>

								{p.drive_url && (
									<a
										href={p.drive_url}
										target="_blank"
										rel="noopener noreferrer"
										onClick={(e) => e.stopPropagation()}
										className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline w-fit"
									>
										<ExternalLink className="w-3.5 h-3.5" />
										Drive klasörü
									</a>
								)}
							</Card>
						);
					})}
				</div>
			)}

			{editing && (
				<ProjectForm
					mode={editing.mode}
					initial={editing.mode === "edit" ? editing.project : undefined}
					onClose={() => setEditing(null)}
					onDone={() => {
						setEditing(null);
						refetch();
					}}
				/>
			)}
		</AppShell>
	);
}
