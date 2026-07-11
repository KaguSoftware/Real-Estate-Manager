"use client";

/**
 * /settings/billing — trial countdown, plan cards, subscription status.
 * Owners can subscribe; agents see status plus a "talk to your owner" note.
 * The database (team_is_writable in RLS) is the enforcement; this page is UX.
 */

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/src/store";
import { createClient } from "@/src/lib/supabase/client";
import { fetchTeamContext } from "@/src/lib/db/teams";
import { AppShell, Card, CardLabel, Badge, Button, Alert, SpinnerBlock, toast } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

interface Plan {
	id: string;
	name: string;
	price_monthly: number;
	currency: string;
	max_seats: number | null;
}

const STATUS_LABEL: Record<string, { label: string; tone: "emerald" | "amber" | "red" | "slate" }> = {
	trialing: { label: "Free trial", tone: "amber" },
	active:   { label: "Active",     tone: "emerald" },
	past_due: { label: "Payment overdue", tone: "red" },
	canceled: { label: "Canceled",   tone: "slate" },
};

export default function BillingPage() {
	const team = useAppStore((s) => s.team);
	const setTeam = useAppStore((s) => s.setTeam);
	const isOwner = team?.role === "owner";

	const [plans, setPlans] = useState<Plan[] | null>(null);
	const [busyPlan, setBusyPlan] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const supabase = createClient();
		supabase
			.from("plans")
			.select("id, name, price_monthly, currency, max_seats")
			.eq("is_active", true)
			.order("price_monthly", { ascending: true })
			.then(({ data }) => setPlans((data ?? []) as Plan[]));
		// Refresh subscription state on arrival (e.g. back from checkout) and
		// celebrate when the checkout actually flipped the subscription on.
		const wasActive = useAppStore.getState().team?.subscription_status === "active";
		fetchTeamContext()
			.then((t) => {
				setTeam(t);
				if (t?.subscription_status === "active" && !wasActive) {
					toast.success("Subscription activated 🎉");
				}
			})
			.catch(() => {});
	}, [setTeam]);

	async function subscribe(planId: string) {
		setError(null);
		setBusyPlan(planId);
		try {
			const res = await fetch("/api/billing/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ plan_id: planId }),
			});
			const json = (await res.json()) as { url?: string; error?: string };
			if (!res.ok || !json.url) throw new Error(json.error || "Checkout failed");
			window.location.href = json.url;
		} catch (e) {
			setError(humanizeError(e));
			setBusyPlan(null);
		}
	}

	const trialDaysLeft = team
		? Math.max(0, Math.ceil((new Date(team.trial_ends_at).getTime() - Date.now()) / 86_400_000))
		: 0;
	const status = team?.subscription_status ?? "trialing";
	const meta = STATUS_LABEL[status] ?? STATUS_LABEL.trialing;
	const onTrial = status === "trialing";

	return (
		<AppShell title="Billing" subtitle={team?.name}>
			<div className="space-y-4">
				{error && <Alert tone="error">{error}</Alert>}

				<Card>
					<div className="flex items-center justify-between gap-3">
						<div>
							<CardLabel>Subscription</CardLabel>
							<p className="mt-1 text-sm text-slate-600">
								{onTrial
									? trialDaysLeft > 0
										? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial.`
										: "Your free trial has ended — the workspace is read-only until you subscribe."
									: status === "active" && team?.current_period_end
										? `Paid through ${new Date(team.current_period_end).toLocaleDateString()}.`
										: status === "past_due"
											? "The last payment failed. Update payment to keep write access."
											: "No active subscription — the workspace is read-only."}
							</p>
						</div>
						<Badge tone={onTrial && trialDaysLeft === 0 ? "red" : meta.tone}>
							{onTrial && trialDaysLeft === 0 ? "Trial ended" : meta.label}
						</Badge>
					</div>
				</Card>

				{plans === null ? (
					<SpinnerBlock />
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{plans.map((p) => {
							const current = team?.plan_id === p.id && status === "active";
							return (
								<Card key={p.id} className={current ? "ring-2 ring-primary/40" : undefined}>
									<div className="flex items-baseline justify-between">
										<h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
										{current && <Badge tone="emerald">Current plan</Badge>}
									</div>
									<p className="mt-2 text-3xl font-bold text-slate-900">
										₺{Number(p.price_monthly).toLocaleString("tr-TR")}
										<span className="text-sm font-normal text-slate-400"> / month</span>
									</p>
									<ul className="mt-3 space-y-1.5 text-sm text-slate-600">
										<li className="flex items-center gap-2">
											<CheckCircle2 className="w-4 h-4 text-emerald-500" />
											{p.max_seats ? `Up to ${p.max_seats} agents` : "Unlimited agents"}
										</li>
										<li className="flex items-center gap-2">
											<CheckCircle2 className="w-4 h-4 text-emerald-500" />
											Properties, clients, contracts & payments
										</li>
									</ul>
									{isOwner ? (
										<Button
											block
											className="mt-4"
											variant={current ? "outline" : "primary"}
											disabled={current}
											loading={busyPlan === p.id}
											onClick={() => subscribe(p.id)}
										>
											{current ? "Subscribed" : "Subscribe"}
										</Button>
									) : (
										<p className="mt-4 text-xs text-slate-400 text-center">
											Only the team owner can manage billing.
										</p>
									)}
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</AppShell>
	);
}
