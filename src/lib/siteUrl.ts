// Single source of truth for the app's canonical origin.
//
// Every auth email link, OAuth/callback redirect, invite link and SEO URL must
// resolve to the SAME host — otherwise Supabase falls back to its dashboard
// Site URL (historically http://localhost:3000) and users get bounced to
// localhost. Keeping one helper avoids the drift that caused that bug (three
// different fallback domains lived across the codebase).
//
// NEXT_PUBLIC_SITE_URL is inlined at build time, so it works on both client and
// server. Pass a request-derived origin as the fallback where one exists:
//   - Client:  getSiteUrl(window.location.origin)
//   - Server:  getSiteUrl(request.nextUrl.origin)
// The final fallback is the real production domain, never localhost.
//
// `||` (not `??`) is deliberate: an empty-string env var must also fall back.
export function getSiteUrl(fallbackOrigin?: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    fallbackOrigin ||
    "https://kagu-realestate.com";
  return base.replace(/\/$/, "");
}
