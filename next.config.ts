import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Baseline security headers applied to every response. We intentionally keep the
// CSP scoped to frame-ancestors (clickjacking protection) rather than a full
// script-src policy, which would need nonce plumbing for Next's inline scripts —
// that can be tightened later without blocking these wins today.
const securityHeaders = [
				{ key: "X-Frame-Options", value: "DENY" },
				{ key: "X-Content-Type-Options", value: "nosniff" },
				{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
				{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
				{
								key: "Strict-Transport-Security",
								value: "max-age=63072000; includeSubDomains; preload",
				},
];

const nextConfig: NextConfig = {
				experimental: {
								// Client-side route cache. `dynamic` defaults to 0 in Next 15+, so
								// every navigation — including Back — re-ran the server component and
								// its auth check before rendering anything. 30s means moving between
								// /properties, a detail page and back is served from the client cache
								// within a working burst, while still refreshing on any real revisit.
								//
								// This caches the RENDERED SEGMENT, not the data: the lists fetch
								// through useCachedResource, which revalidates in the background on
								// mount regardless, so nobody sees stale rows for 30s — they see the
								// last known rows instantly and the fresh ones a moment later.
								staleTimes: {
												dynamic: 30,
												static: 180,
								},
				},
				images: {
								remotePatterns: [
												{
																protocol: "https",
																hostname: "*.supabase.co",
																pathname: "/storage/v1/object/public/**",
												},
								],
				},
				async headers() {
								return [{ source: "/:path*", headers: securityHeaders }];
				},
};

export default withSentryConfig(nextConfig, {
 // For all available options, see:
	// https://www.npmjs.com/package/@sentry/webpack-plugin#options

	org: "kagu-software",

 project: "javascript-nextjs",

 // Only print logs for uploading source maps in CI
	silent: !process.env.CI,

 // For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

 // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	// This can increase your server load as well as your hosting bill.
	// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
	// side errors will fail.
	// tunnelRoute: "/monitoring",

	webpack: {
			// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
			// See the following for more information:
			// https://docs.sentry.io/product/crons/
			// https://vercel.com/docs/cron-jobs
			automaticVercelMonitors: true,

			// Tree-shaking options for reducing bundle size
			treeshake: {
					// Automatically tree-shake Sentry logger statements to reduce bundle size
					removeDebugLogging: true,
			},
	},
});
