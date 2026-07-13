-- Multi-month billing periods (1/3/6/12) with app-computed discounts.
-- Discount % and the period list are fixed business rules (see
-- src/lib/billing/provider.ts PERIOD_DISCOUNTS) — no per-plan config needed.

alter table public.subscriptions
	add column if not exists period_months integer not null default 1
	constraint subscriptions_period_months_check check (period_months in (1, 3, 6, 12));
