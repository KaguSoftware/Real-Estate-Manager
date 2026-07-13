// Payment-provider abstraction. The app only ever talks to this interface;
// the concrete provider (Iyzico, or the mock used until Iyzico is wired) is
// selected in ./index.ts via the BILLING_PROVIDER env var.

export type BillingEventType =
	| "payment_succeeded"
	| "payment_failed"
	| "subscription_canceled";

/** A provider webhook, normalized. providerEventId powers idempotency:
 *  the webhook route inserts it into billing_events with ON CONFLICT DO
 *  NOTHING and skips processing on replay. */
export interface NormalizedEvent {
	providerEventId: string;
	teamId: string;
	type: BillingEventType;
	/** New paid-through date, for payment_succeeded. */
	periodEnd?: string;
	/** Plan purchased (payment_succeeded). */
	planId?: string;
	/** Billing period purchased, in months (payment_succeeded). Defaults to 1 if absent. */
	periodMonths?: number;
	/** Provider's own subscription reference. */
	providerSubscriptionId?: string;
	raw: unknown;
}

export interface CheckoutResult {
	/** Where to send the user to pay. */
	url: string;
}

/** Billing periods offered at checkout, in months. */
export const BILLING_PERIODS = [1, 3, 6, 12] as const;
export type BillingPeriodMonths = (typeof BILLING_PERIODS)[number];

/** % off the monthly rate for each multi-month period, applied to the total. */
export const PERIOD_DISCOUNTS: Record<BillingPeriodMonths, number> = {
	1: 0,
	3: 0.15,
	6: 0.2,
	12: 0.25,
};

export interface PaymentProvider {
	readonly name: string;
	/** Start a subscription purchase for a team+plan+period; returns a redirect URL. */
	createCheckout(
		teamId: string,
		planId: string,
		months: BillingPeriodMonths,
		opts: { returnUrl: string },
	): Promise<CheckoutResult>;
	cancelSubscription(providerSubscriptionId: string): Promise<void>;
	/** Verify authenticity (signature) and normalize the webhook payload.
	 *  MUST throw on an invalid signature. */
	verifyWebhook(request: Request): Promise<NormalizedEvent>;
}
