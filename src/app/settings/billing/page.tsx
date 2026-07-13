"use client";

/**
 * /settings/billing — trial countdown, plan cards, subscription status,
 * seat usage and self-service cancellation.
 * Owners manage billing; agents see status plus a "talk to your owner" note.
 * The database (team_is_writable in RLS) is the enforcement; this page is UX.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/src/store";
import { createClient } from "@/src/lib/supabase/client";
import { fetchTeamContext, listTeamMembers } from "@/src/lib/db/teams";
import { AppShell, Card, CardLabel, Badge, Button, Alert, SpinnerBlock, ConfirmDialog, toast, cn } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";
import { BILLING_PERIODS, PERIOD_DISCOUNTS, type BillingPeriodMonths } from "@/src/lib/billing/provider";

const PERIOD_LABEL: Record<BillingPeriodMonths, string> = {
	1: "Aylık",
	3: "3 Ay",
	6: "6 Ay",
	12: "12 Ay",
};

interface Plan {
	id: string;
	name: string;
	price_monthly: number;
	currency: string;
	max_seats: number | null;
}

// Mirrors public.plans (0021): starter = tracker, pro = tracker + document builder.
const PLAN_FEATURES: Record<string, string[]> = {
	starter: [
		"Müşteri ve taşınmaz takibi (CRM)",
		"Kira ve tahsilat takibi",
		"Akıllı hatırlatmalar",
		"CSV dışa aktarma",
	],
	pro: [
		"Takip paketindeki her şey",
		"Belge oluşturucu",
		"Sözleşme ve makbuz PDF'leri",
		"Belge şablonları ve arşiv",
	],
};

const STATUS_LABEL: Record<string, { label: string; tone: "emerald" | "amber" | "red" | "slate" }> = {
	trialing: { label: "Ücretsiz deneme", tone: "amber" },
	active:   { label: "Etkin",           tone: "emerald" },
	past_due: { label: "Ödeme gecikti",   tone: "red" },
	canceled: { label: "İptal edildi",    tone: "slate" },
};

export default function BillingPage() {
	const team = useAppStore((s) => s.team);
	const setTeam = useAppStore((s) => s.setTeam);
	const isOwner = team?.role === "owner";

	const [plans, setPlans] = useState<Plan[] | null>(null);
	const [seatCount, setSeatCount] = useState<number | null>(null);
	const [busyPlan, setBusyPlan] = useState<string | null>(null);
	const [months, setMonths] = useState<BillingPeriodMonths>(1);
	const [confirmCancel, setConfirmCancel] = useState(false);
	const [canceling, setCanceling] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const supabase = createClient();
		supabase
			.from("plans")
			.select("id, name, price_monthly, currency, max_seats")
			.eq("is_active", true)
			.order("price_monthly", { ascending: true })
			.then(({ data }) => setPlans((data ?? []) as Plan[]));
		listTeamMembers().then((m) => setSeatCount(m.length)).catch(() => {});
		// Refresh subscription state on arrival (e.g. back from checkout) and
		// celebrate when the checkout actually flipped the subscription on.
		const wasActive = useAppStore.getState().team?.subscription_status === "active";
		fetchTeamContext()
			.then((t) => {
				setTeam(t);
				if (t?.subscription_status === "active" && !wasActive) {
					toast.success("Aboneliğiniz etkinleştirildi 🎉");
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
				body: JSON.stringify({ plan_id: planId, months }),
			});
			const json = (await res.json()) as { url?: string; error?: string };
			if (!res.ok || !json.url) throw new Error(json.error || "Ödeme sayfası açılamadı");
			window.location.href = json.url;
		} catch (e) {
			setError(humanizeError(e));
			setBusyPlan(null);
		}
	}

	async function cancelSubscription() {
		setError(null);
		setCanceling(true);
		try {
			const res = await fetch("/api/billing/cancel", { method: "POST" });
			const json = (await res.json()) as { url?: string; ok?: boolean; error?: string };
			if (!res.ok) throw new Error(json.error || "İptal işlemi başarısız oldu");
			if (json.url) {
				// Mock flow (dev): the webhook applies the change and redirects back.
				window.location.href = json.url;
				return;
			}
			toast.success("İptal talebiniz alındı. Ödenen dönemin sonuna kadar erişiminiz sürer.");
			setConfirmCancel(false);
			setTeam(await fetchTeamContext());
		} catch (e) {
			setError(humanizeError(e));
			setConfirmCancel(false);
		} finally {
			setCanceling(false);
		}
	}

	const trialDaysLeft = team
		? Math.max(0, Math.ceil((new Date(team.trial_ends_at).getTime() - Date.now()) / 86_400_000))
		: 0;
	const status = team?.subscription_status ?? "trialing";
	const meta = STATUS_LABEL[status] ?? STATUS_LABEL.trialing;
	const onTrial = status === "trialing";
	const cancellable = isOwner && (status === "active" || status === "past_due");
	const currentPlan = plans?.find((p) => p.id === team?.plan_id);

	return (
		<AppShell title="Abonelik" subtitle={team?.name}>
			<div className="space-y-4">
				{error && <Alert tone="error">{error}</Alert>}

				<Card>
					<div className="flex items-center justify-between gap-3">
						<div>
							<CardLabel>Abonelik durumu</CardLabel>
							<p className="mt-1 text-sm text-base-content/70">
								{onTrial
									? trialDaysLeft > 0
										? `Ücretsiz deneme sürenizin bitmesine ${trialDaysLeft} gün kaldı.`
										: "Ücretsiz deneme süreniz doldu — abonelik başlatana kadar çalışma alanı salt okunur."
									: status === "active" && team?.current_period_end
										? `Ödemesi ${new Date(team.current_period_end).toLocaleDateString("tr-TR")} tarihine kadar yapıldı.`
										: status === "past_due"
											? "Son ödeme başarısız oldu. Yazma erişiminizi korumak için ödemenizi güncelleyin."
											: "Etkin abonelik yok — çalışma alanı salt okunur."}
							</p>
							{seatCount !== null && currentPlan?.max_seats != null && (
								<p className="mt-1 text-xs text-base-content/50">
									Kullanılan üyelik: {seatCount} / {currentPlan.max_seats}
								</p>
							)}
						</div>
						<Badge tone={onTrial && trialDaysLeft === 0 ? "red" : meta.tone}>
							{onTrial && trialDaysLeft === 0 ? "Deneme sona erdi" : meta.label}
						</Badge>
					</div>
					{cancellable && (
						<div className="mt-3 border-t border-base-300 pt-3 flex justify-end">
							<Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>
								Aboneliği iptal et
							</Button>
						</div>
					)}
				</Card>

				{plans === null ? (
					<SpinnerBlock />
				) : (
					<>
						<div
							role="radiogroup"
							aria-label="Ödeme dönemi"
							className="flex rounded-lg border border-base-300 bg-base-200 p-0.5 max-w-md"
						>
							{BILLING_PERIODS.map((m) => (
								<button
									key={m}
									type="button"
									role="radio"
									aria-checked={months === m}
									onClick={() => setMonths(m)}
									className={cn(
										"relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors min-h-11",
										months === m
											? "text-primary"
											: "text-base-content/60 hover:text-base-content",
									)}
								>
									{months === m && (
										<motion.span
											layoutId="period-pill"
											className="absolute inset-0 rounded-md bg-base-100 shadow-soft"
											transition={{ type: "spring", stiffness: 500, damping: 35 }}
										/>
									)}
									<span className="relative">{PERIOD_LABEL[m]}</span>
									{PERIOD_DISCOUNTS[m] > 0 && (
										<span className="relative text-[10px] font-semibold text-success">
											%{Math.round(PERIOD_DISCOUNTS[m] * 100)} indirim
										</span>
									)}
								</button>
							))}
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{plans.map((p) => {
							const current = team?.plan_id === p.id && status === "active";
							const discount = PERIOD_DISCOUNTS[months];
							const fullTotal = Number(p.price_monthly) * months;
							const total = fullTotal * (1 - discount);
							const effectiveMonthly = total / months;
							const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
							return (
								<Card key={p.id} className={current ? "ring-2 ring-primary/40" : undefined}>
									<div className="flex items-baseline justify-between">
										<h3 className="text-lg font-bold text-base-content">{p.name}</h3>
										{current && <Badge tone="emerald">Mevcut plan</Badge>}
									</div>
									<AnimatePresence mode="wait" initial={false}>
										<motion.div
											key={months}
											initial={{ opacity: 0, y: -6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: 6 }}
											transition={{ duration: 0.18, ease: "easeOut" }}
										>
											<p className="mt-2 text-3xl font-bold text-base-content">
												{fmt(total)} TL
												<span className="text-sm font-normal text-base-content/50"> / {PERIOD_LABEL[months].toLowerCase()}</span>
											</p>
											<p className={cn("mt-1 text-xs", months === 1 && "invisible")} aria-hidden={months === 1}>
												{months > 1 ? (
													<>
														<span className="text-base-content/40 line-through">{fmt(fullTotal)} TL</span>
														<span className="ml-1.5 font-semibold text-success">%{Math.round(discount * 100)} indirim</span>
													</>
												) : (
													" "
												)}
											</p>
										</motion.div>
									</AnimatePresence>
									<ul className="mt-3 space-y-1.5 text-sm text-base-content/70">
										{(PLAN_FEATURES[p.id] ?? [
											p.max_seats ? `En fazla ${p.max_seats} danışman` : "Sınırsız danışman",
											"Portföy, müşteri, sözleşme ve tahsilat yönetimi",
										]).map((feature) => (
											<li key={feature} className="flex items-center gap-2">
												<CheckCircle2 className="w-4 h-4 text-success" />
												{feature}
											</li>
										))}
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
											{current ? "Abonesiniz" : "Abone ol"}
										</Button>
									) : (
										<p className="mt-4 text-xs text-base-content/50 text-center">
											Aboneliği yalnızca ekip sahibi yönetebilir.
										</p>
									)}
								</Card>
							);
						})}
						</div>
					</>
				)}
			</div>

			<ConfirmDialog
				open={confirmCancel}
				title="Abonelik iptal edilsin mi?"
				message="Ödenen dönemin sonuna kadar erişiminiz devam eder; sonrasında çalışma alanı salt okunur olur. Verileriniz silinmez."
				confirmLabel="Aboneliği iptal et"
				cancelLabel="Vazgeç"
				loading={canceling}
				onConfirm={cancelSubscription}
				onCancel={() => setConfirmCancel(false)}
			/>
		</AppShell>
	);
}
