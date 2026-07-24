"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { humanizeError } from "@/src/lib/errors";
import { useAppStore, useIsWritable } from "@/src/store";
import { getProject } from "@/src/lib/db/projects";
import { listProperties } from "@/src/lib/db/properties";
import type { Project, Property } from "@/src/lib/db/types";
import {
	AppShell, Card, CardLabel, Button, Alert, Spinner, Badge, EmptyState,
} from "@/src/components/ui";
import { ProjectForm } from "./ProjectForm";
import { Building2, ExternalLink, Home, Pencil, Plus } from "lucide-react";

interface Props {
	projectId: string;
}

function fmtPrice(p: number | null, ccy: string): string {
	if (p == null) return "—";
	return `${Math.round(p).toLocaleString("tr-TR")} ${ccy}`;
}

function fmtDate(d: string | null): string | null {
	if (!d) return null;
	const parsed = new Date(d);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toLocaleDateString("tr-TR", { year: "numeric", month: "long" });
}

export function ProjectDetail({ projectId }: Props) {
	const router = useRouter();
	const isWritable = useIsWritable();
	const upsertProject = useAppStore((s) => s.upsertProject);

	const [project, setProject] = useState<Project | null>(null);
	const [units, setUnits] = useState<Property[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			const p = await getProject(projectId);
			setProject(p);
			upsertProject(p);
			// Units are optional — a project with none is normal, not an error.
			setUnits(await listProperties({ project_id: projectId }));
			setError(null);
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setLoading(false);
		}
	}, [projectId, upsertProject]);

	useEffect(() => { reload(); }, [reload]);

	if (loading && !project) {
		return (
			<AppShell title="Proje">
				<div className="py-16 flex justify-center"><Spinner /></div>
			</AppShell>
		);
	}

	if (error && !project) {
		return (
			<AppShell title="Proje">
				<Alert>{error}</Alert>
				<Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/projects")}>
					← Projelere dön
				</Button>
			</AppShell>
		);
	}

	if (!project) return null;

	const delivery = fmtDate(project.delivery_date);
	const location = [project.mahalle, project.city].filter(Boolean).join(", ");

	return (
		<AppShell title={project.name}>
			{error && <Alert className="mb-4">{error}</Alert>}

			<Card className="mb-4">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0">
						<h1 className="font-display text-xl font-semibold">{project.name}</h1>
						{project.developer_name && (
							<p className="text-base-content/60 mt-0.5 flex items-center gap-1.5">
								<Building2 className="w-4 h-4 shrink-0" />
								{project.developer_name}
							</p>
						)}
					</div>
					{isWritable && (
						<Button variant="outline" size="sm" onClick={() => setEditing(true)} className="shrink-0">
							<Pencil className="w-4 h-4" />
							Düzenle
						</Button>
					)}
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
					<div>
						<CardLabel>Başlangıç fiyatı</CardLabel>
						<p className="font-medium tabular-nums mt-0.5">
							{fmtPrice(project.price_from, project.price_currency)}
						</p>
					</div>
					<div>
						<CardLabel>Konum</CardLabel>
						<p className="font-medium mt-0.5">{location || "—"}</p>
					</div>
					<div>
						<CardLabel>Teslim</CardLabel>
						<p className="font-medium mt-0.5">{delivery ?? "—"}</p>
					</div>
					<div>
						<CardLabel>Bağlı taşınmaz</CardLabel>
						<p className="font-medium tabular-nums mt-0.5">{units.length}</p>
					</div>
				</div>

				{/* The project's real content lives in the developer's Drive folder;
				    this button is the point of the whole record. */}
				{project.drive_url && (
					<a
						href={project.drive_url}
						target="_blank"
						rel="noopener noreferrer"
						className="btn btn-primary mt-6 w-full sm:w-auto"
					>
						<ExternalLink className="w-4 h-4" />
						Drive klasörünü aç
					</a>
				)}

				{project.notes && (
					<div className="mt-6">
						<CardLabel>Notlar</CardLabel>
						<p className="mt-1 whitespace-pre-wrap text-base-content/80">{project.notes}</p>
					</div>
				)}
			</Card>

			<Card padded={false}>
				<div className="flex items-center justify-between p-4 sm:p-6 pb-3">
					<CardLabel>Bu projedeki taşınmazlar</CardLabel>
					{isWritable && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => router.push(`/properties/new?project=${project.id}`)}
						>
							<Plus className="w-4 h-4" />
							Taşınmaz ekle
						</Button>
					)}
				</div>

				{units.length === 0 ? (
					<EmptyState
						icon={Home}
						title="Henüz taşınmaz bağlı değil"
						hint="Belirli bir daire için kayıt açmanız gerektiğinde ekleyin — katalog ve fiyat listesi Drive klasöründe kalabilir."
					/>
				) : (
					<ul className="divide-y divide-base-300/70">
						{units.map((u) => (
							<li key={u.id}>
								<button
									type="button"
									onClick={() => router.push(`/properties/${u.id}`)}
									className="w-full text-left px-4 sm:px-6 py-3 hover:bg-base-200/60 transition-colors flex items-center justify-between gap-4"
								>
									<span className="min-w-0">
										<span className="block font-medium truncate">{u.address_line}</span>
										<span className="block text-sm text-base-content/60 truncate">
											{[u.nitelik, u.city].filter(Boolean).join(" · ") || "—"}
										</span>
									</span>
									<span className="flex items-center gap-2 shrink-0">
										{u.is_new_build && <Badge tone="indigo">Sıfır</Badge>}
										<span className="tabular-nums text-sm font-medium">
											{fmtPrice(u.list_price, u.currency)}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</Card>

			{editing && (
				<ProjectForm
					mode="edit"
					initial={project}
					onClose={() => setEditing(false)}
					onDone={() => {
						setEditing(false);
						// The project may have been deleted from the form.
						router.push("/projects");
					}}
				/>
			)}
		</AppShell>
	);
}
