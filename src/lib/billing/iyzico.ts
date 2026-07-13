// Iyzico provider — STUB. Wire this up once the Iyzico merchant account and
// tier prices exist. Reference: https://docs.iyzico.com (Subscription API:
// create a subscription product + pricing plan per row in public.plans, then
// initialize a checkout form per team here).
//
// Required env: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL
// (sandbox: https://sandbox-api.iyzipay.com, prod: https://api.iyzipay.com)

import type { PaymentProvider, NormalizedEvent } from "./provider";

export const iyzicoProvider: PaymentProvider = {
	name: "iyzico",

	async createCheckout() {
		// TODO(iyzico): POST /v2/subscription/checkoutform/initialize with the
		// iyzico pricingPlanReferenceCode for this plan+months (one pricing plan
		// per period, priced via PERIOD_DISCOUNTS) and callbackUrl=returnUrl;
		// return { url: checkoutFormContentUrl }.
		throw new Error("Iyzico is not configured yet — set BILLING_PROVIDER=mock for testing");
	},

	async cancelSubscription() {
		// TODO(iyzico): POST /v2/subscription/subscriptions/{id}/cancel
		throw new Error("Iyzico is not configured yet");
	},

	async verifyWebhook(): Promise<NormalizedEvent> {
		// TODO(iyzico): verify the X-IYZ-SIGNATURE-V3 header — HMAC-SHA256 of
		// (secretKey, eventType + iyziEventTime + token…) per iyzico docs —
		// then map eventType: subscription.order.success → payment_succeeded,
		// subscription.order.failure → payment_failed,
		// subscription.canceled → subscription_canceled. Resolve teamId from
		// provider_subscription_id on public.subscriptions.
		throw new Error("Iyzico webhooks are not configured yet");
	},
};
