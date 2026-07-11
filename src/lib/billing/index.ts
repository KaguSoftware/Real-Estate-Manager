import type { PaymentProvider } from "./provider";
import { iyzicoProvider } from "./iyzico";
import { mockProvider } from "./mock";

/** Selected by BILLING_PROVIDER (server-only): 'iyzico' | 'mock'. */
export function getPaymentProvider(): PaymentProvider {
	const name = process.env.BILLING_PROVIDER ?? "iyzico";
	if (name === "mock") {
		if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_BILLING !== "1") {
			throw new Error("mock billing provider is disabled in production");
		}
		return mockProvider;
	}
	return iyzicoProvider;
}

export type { PaymentProvider, NormalizedEvent, BillingEventType } from "./provider";
