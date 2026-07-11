// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Overridable per environment; set NEXT_PUBLIC_SENTRY_DSN="" to disable.
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://ef73059a7078eaf95ec068cf07e5fec4@o4511716739121152.ingest.de.sentry.io/4511716739383376",

  tracesSampleRate: 0.1,

  enableLogs: false,

  dataCollection: {
    // Contracts/leases carry tenants' national IDs and phone numbers — never
    // ship request bodies or user info to Sentry.
    userInfo: false,
    httpBodies: [],
  },
});
