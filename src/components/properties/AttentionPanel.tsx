"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/src/store";
import { getAttentionData } from "@/src/lib/db/attention";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { fmtMoney } from "@/src/lib/format";
import { cn } from "@/src/components/ui";
import {
	AlertTriangle, CalendarClock, PhoneMissed, Wallet, ChevronDown, ChevronRight,
} from "lucide-react";

/**
 * "Needs attention" panel above the KPI strip: overdue rent, rent due within
 * 7 days, leases ending within 30 days, and leads silent for 14+ days.
 * Hidden entirely when there is nothing to show.
 */
export function AttentionPanel() {
	const user = useAppStore((s) => s.user);
	const [open, setOpen] = useState(true);
	const { data } = useCachedResource(
		user ? "attention" : null,
		getAttentionData,
		undefined,
		{ enabled: !!user },
	);

	if (!data || data.total === 0) return null;

	const hasUrgent = data.overduePayments.length > 0;

	return (
		<div
			className={cn(
				"mb-4 rounded-2xl border shadow-card overflow-hidden",
				hasUrgent ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/60",
			)}
		>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				className="w-full flex items-center gap-2 px-4 py-3 text-left"
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
				{open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
			</button>

			{open && (
				<div className="px-4 pb-3 space-y-3">
					{data.overduePayments.length > 0 && (
						<Section icon={Wallet} title="Overdue rent" tone="red">
							{data.overduePayments.map((p) => (
								<Row key={p.paymentId} href={`/properties/${p.propertyId}`}>
									<span className="truncate">{p.propertyLabel}</span>
									<span className="font-semibold text-red-600 whitespace-nowrap">
										{fmtMoney(p.outstanding, p.currency)}
									</span>
									<span className="text-slate-400 whitespace-nowrap">due {p.periodEnd}</span>
								</Row>
							))}
						</Section>
					)}

					{data.upcomingPayments.length > 0 && (
						<Section icon={Wallet} title="Rent due in the next 7 days" tone="amber">
							{data.upcomingPayments.map((p) => (
								<Row key={p.paymentId} href={`/properties/${p.propertyId}`}>
									<span className="truncate">{p.propertyLabel}</span>
									<span className="font-semibold text-slate-700 whitespace-nowrap">
										{fmtMoney(p.outstanding, p.currency)}
									</span>
									<span className="text-slate-400 whitespace-nowrap">due {p.periodEnd}</span>
								</Row>
							))}
						</Section>
					)}

					{data.endingLeases.length > 0 && (
						<Section icon={CalendarClock} title="Leases ending within 30 days" tone="amber">
							{data.endingLeases.map((l) => (
								<Row key={l.leaseId} href={`/properties/${l.propertyId}`}>
									<span className="truncate">{l.propertyLabel}</span>
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
									<span className="truncate">{l.name}</span>
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
