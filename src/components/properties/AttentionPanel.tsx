"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/src/store";
import { getAttentionData } from "@/src/lib/db/attention";
import {
	DEFAULT_USER_SETTINGS,
	getUserSettings,
	updateUserSettings,
	type UserSettings,
} from "@/src/lib/db/settings";
import { humanizeError } from "@/src/lib/errors";
import { invalidateCache, mutateCache, useCachedResource } from "@/src/lib/useCachedResource";
import { fmtMoney } from "@/src/lib/format";
import { Button, cn, toast } from "@/src/components/ui";
import {
	AlertTriangle, CalendarClock, PhoneMissed, Wallet, ChevronDown, ChevronRight, Settings2,
} from "lucide-react";

/**
 * "Needs attention" panel above the KPI strip: overdue rent, rent due soon,
 * leases ending soon, and silent leads. Thresholds are per-user
 * (profiles.settings, editable via the gear). Hidden when nothing to show.
 */
export function AttentionPanel() {
	const user = useAppStore((s) => s.user);
	const [open, setOpen] = useState(true);
	const [editing, setEditing] = useState(false);

	const { data: settings } = useCachedResource(
		user ? "settings" : null,
		getUserSettings,
		undefined,
		{ enabled: !!user },
	);
	const thresholds = settings ?? DEFAULT_USER_SETTINGS;

	const { data } = useCachedResource(
		user ? `attention:${thresholds.upcomingDays}:${thresholds.leaseWarnDays}:${thresholds.leadSilentDays}` : null,
		() => getAttentionData(thresholds),
		undefined,
		{ enabled: !!user },
	);

	if (!data) return null;
	if (data.total === 0 && !editing) {
		// Still allow reaching the settings from an all-clear state? No panel
		// shown — thresholds remain editable next time something surfaces.
		return null;
	}

	const hasUrgent = data.overduePayments.length > 0;

	return (
		<div
			className={cn(
				"mb-4 rounded-2xl border shadow-card overflow-hidden",
				hasUrgent ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/60",
			)}
		>
			{/* div (not button) so the settings gear can live inside without
			    invalid interactive nesting — same pattern as the card lists. */}
			<div
				role="button"
				tabIndex={0}
				onClick={() => setOpen((o) => !o)}
				onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
				aria-expanded={open}
				className="w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer"
			>
				<AlertTriangle className={cn("w-4 h-4", hasUrgent ? "text-red-500" : "text-amber-500")} />
				<span className="text-sm font-semibold text-slate-800 flex-1">
					Needs attention
					<span className={cn(
						"ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold text-white",
						hasUrgent ? "bg-red-500" : "bg-amber-500",
					)}>
						{data.total}
					</span>
				</span>
				<span
					role="button"
					tabIndex={0}
					aria-label="Attention settings"
					title="Adjust attention thresholds"
					onClick={(e) => { e.stopPropagation(); setEditing((v) => !v); }}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							e.stopPropagation();
							setEditing((v) => !v);
						}
					}}
					className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/70 transition-colors"
				>
					<Settings2 className="w-4 h-4" />
				</span>
				{open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
			</div>

			{editing && (
				<ThresholdEditor
					initial={thresholds}
					onClose={() => setEditing(false)}
				/>
			)}

			{open && (
				<div className="px-4 pb-3 space-y-3">
					{data.overduePayments.length > 0 && (
						<Section icon={Wallet} title="Overdue rent" tone="red">
							{data.overduePayments.map((p) => (
								<Row key={p.paymentId} href={`/properties/${p.propertyId}`}>
									<span className="flex-1 min-w-0 truncate">{p.propertyLabel}</span>
									<span className="font-semibold text-red-600 whitespace-nowrap">
										{fmtMoney(p.outstanding, p.currency)}
									</span>
									<span className="text-xs text-slate-400 whitespace-nowrap">due {p.periodEnd}</span>
								</Row>
							))}
						</Section>
					)}

					{data.upcomingPayments.length > 0 && (
						<Section icon={Wallet} title={`Rent due in the next ${thresholds.upcomingDays} days`} tone="amber">
							{data.upcomingPayments.map((p) => (
								<Row key={p.paymentId} href={`/properties/${p.propertyId}`}>
									<span className="flex-1 min-w-0 truncate">{p.propertyLabel}</span>
									<span className="font-semibold text-slate-700 whitespace-nowrap">
										{fmtMoney(p.outstanding, p.currency)}
									</span>
									<span className="text-xs text-slate-400 whitespace-nowrap">due {p.periodEnd}</span>
								</Row>
							))}
						</Section>
					)}

					{data.endingLeases.length > 0 && (
						<Section icon={CalendarClock} title={`Leases ending within ${thresholds.leaseWarnDays} days`} tone="amber">
							{data.endingLeases.map((l) => (
								<Row key={l.leaseId} href={`/properties/${l.propertyId}`}>
									<span className="flex-1 min-w-0 truncate">{l.propertyLabel}</span>
									<span className="text-slate-500 whitespace-nowrap">
										ends {l.endDate} ({l.daysLeft} day{l.daysLeft === 1 ? "" : "s"})
									</span>
								</Row>
							))}
						</Section>
					)}

					{data.staleLeads.length > 0 && (
						<Section icon={PhoneMissed} title="Leads waiting on a follow-up" tone="amber">
							{data.staleLeads.map((l) => (
								<Row key={l.leadId} href="/leads">
									<span className="flex-1 min-w-0 truncate">{l.name}</span>
									<span className="text-slate-400 whitespace-nowrap">
										{l.lastCallAt ? `last call ${l.daysSilent} days ago` : `no call in ${l.daysSilent} days`}
									</span>
								</Row>
							))}
						</Section>
					)}
				</div>
			)}
		</div>
	);
}

/** Inline editor for the per-user attention thresholds. */
function ThresholdEditor({ initial, onClose }: { initial: UserSettings; onClose: () => void }) {
	const [form, setForm] = useState<UserSettings>(initial);
	const [saving, setSaving] = useState(false);

	async function save() {
		setSaving(true);
		try {
			const next = await updateUserSettings(form);
			mutateCache("settings", next);
			// New thresholds change what the queries fetch — refetch the feed.
			invalidateCache("attention");
			toast.success("Attention settings saved.");
			onClose();
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setSaving(false);
		}
	}

	const fields: { key: keyof UserSettings; label: string; max: number }[] = [
		{ key: "upcomingDays", label: "Rent due within (days)", max: 90 },
		{ key: "leaseWarnDays", label: "Lease ending within (days)", max: 365 },
		{ key: "leadSilentDays", label: "Lead silent for (days)", max: 365 },
	];

	return (
		<div className="mx-4 mb-3 rounded-xl bg-white/80 border border-slate-200/70 p-3">
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				{fields.map(({ key, label, max }) => (
					<label key={key} className="block">
						<span className="text-xs font-semibold text-slate-500">{label}</span>
						<input
							type="number"
							min={1}
							max={max}
							value={form[key]}
							onChange={(e) => {
								const n = Number(e.target.value);
								setForm((f) => ({ ...f, [key]: Number.isFinite(n) ? n : f[key] }));
							}}
							className="mt-1 w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm text-slate-800 bg-white"
						/>
					</label>
				))}
			</div>
			<div className="mt-3 flex justify-end gap-2">
				<Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
				<Button size="sm" onClick={save} disabled={saving}>
					{saving ? "Saving…" : "Save"}
				</Button>
			</div>
		</div>
	);
}

function Section({
	icon: Icon,
	title,
	tone,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	tone: "red" | "amber";
	children: React.ReactNode;
}) {
	return (
		<div>
			<div className="flex items-center gap-1.5 mb-1">
				<Icon className={cn("w-3.5 h-3.5", tone === "red" ? "text-red-500" : "text-amber-500")} />
				<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
			</div>
			<div className="divide-y divide-slate-200/60 rounded-xl bg-white/70 border border-slate-200/60">
				{children}
			</div>
		</div>
	);
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<Link
			href={href}
			className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
		>
			{children}
		</Link>
	);
}
