// Mock provider for local development / E2E: "checkout" immediately posts a
// synthetic payment_succeeded webhook to our own endpoint, so the full
// subscription state machine can be exercised without a real provider.
// Never enable in production.

import { randomUUID } from "crypto";
import type { PaymentProvider, NormalizedEvent } from "./provider";

export const mockProvider: PaymentProvider = {
	name: "mock",

	async createCheckout(teamId, planId, months, { returnUrl }) {
		const base = returnUrl.replace(/\/settings\/billing.*$/, "");
		const url = new URL(`${base}/api/billing/webhook`);
		url.searchParams.set("mock", "1");
		url.searchParams.set("team_id", teamId);
		url.searchParams.set("plan_id", planId);
		url.searchParams.set("months", String(months));
		// Relative path only — the webhook route rejects absolute URLs to avoid
		// becoming an open redirect.
		url.searchParams.set("return_to", new URL(returnUrl).pathname + new URL(returnUrl).search);
		return { url: url.toString() };
	},

	async cancelSubscription() {
		// nothing to do — state change happens via the webhook route
	},

	async verifyWebhook(request): Promise<NormalizedEvent> {
		const url = new URL(request.url);
		if (url.searchParams.get("mock") !== "1") {
			throw new Error("invalid mock webhook");
		}
		const teamId = url.searchParams.get("team_id");
		if (!teamId) throw new Error("mock webhook missing team_id");
		const months = Number(url.searchParams.get("months") ?? "1") || 1;
		const periodEnd = new Date(Date.now() + months * 30 * 86_400_000).toISOString();
		return {
			providerEventId: `mock-${randomUUID()}`,
			teamId,
			type: (url.searchParams.get("type") as NormalizedEvent["type"]) || "payment_succeeded",
			periodEnd,
			planId: url.searchParams.get("plan_id") ?? undefined,
			periodMonths: months,
			providerSubscriptionId: `mock-sub-${teamId}`,
			raw: Object.fromEntries(url.searchParams),
		};
	},
};
