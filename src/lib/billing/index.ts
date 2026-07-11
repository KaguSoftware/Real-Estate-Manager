import type { PaymentProvider } from "./provider";
import { iyzicoProvider } from "./iyzico";
import { mockProvider } from "./mock";

/** Selected by BILLING_PROVIDER (server-only): 'iyzico' | 'mock'. */
export function getPaymentProvider(): PaymentProvider {
	const name = process.env.BILLING_PROVIDER ?? "iyzico";
	if (name === "mock") {
		// The mock provider authenticates webhooks by a query param and trusts the
		// team_id in the URL, so anyone reaching /api/billing/webhook could forge a
		// subscription. It must never be reachable in production — no env escape hatch.
		if (process.env.NODE_ENV === "production") {
			throw new Error("mock billing provider is disabled in production");
		}
		return mockProvider;
	}
	return iyzicoProvider;
}

export type { PaymentProvider, NormalizedEvent, BillingEventType } from "./provider";
