/**
 * /auth/callback — handles the magic-link redirect from Supabase.
 *
 * Supabase appends `code` (PKCE) or `token_hash` + `type` (OTP/magic-link)
 * query params when redirecting here after the user clicks the email link.
 * We exchange the code/token for a session and redirect the user back to the app.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { getSiteUrl } from "@/src/lib/siteUrl";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as string | null;
  // Force a same-origin relative path: reject absolute URLs and protocol-relative
  // (`//host`) or backslash (`/\host`) tricks so `next` can't become an open redirect.
  const nextParam = searchParams.get("next");
  const next = nextParam && /^\/(?![/\\])/.test(nextParam) ? nextParam : "/";

  // Use NEXT_PUBLIC_SITE_URL if set (production), otherwise fall back to request origin.
  // This avoids http:// vs https:// mismatches on Vercel.
  const siteUrl = getSiteUrl(request.nextUrl.origin);

  const supabase = await createClient();

  // Guard against the "my team disappeared" incident: opening an invite/signup
  // action link while ALREADY signed in as someone else would make verifyOtp
  // silently REPLACE the current session with the invited identity. The original
  // account (e.g. a team owner testing their own invite) is then a team-less
  // session, so proxy.ts bounces it to /onboarding — the team looks deleted but
  // nothing was. Never auto-consume such a link over a live session; hand the
  // user an explicit choice at /auth/switch (the token is left unconsumed, so
  // "continue as the invited account" can replay it). Magic-link / recovery /
  // email-confirm are left alone — those target the same person, not a new one.
  const isOnboardingLink = !!token_hash && (type === "invite" || type === "signup");
  if (isOnboardingLink) {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const to = new URL(`${siteUrl}/auth/switch`);
      to.searchParams.set("token_hash", token_hash!);
      to.searchParams.set("type", type!);
      if (next !== "/") to.searchParams.set("next", next);
      return NextResponse.redirect(to);
    }
  }

  // Team-less users (fresh signups confirming their email) go straight to the
  // onboarding wizard instead of bouncing through / and the middleware.
  async function destination() {
    // An explicit destination (e.g. ?next=/reset-password from the recovery
    // flow) wins — otherwise a team-less user resetting their password would be
    // hijacked to /onboarding and never reach the reset screen.
    if (next !== "/") return next;
    const { data } = await supabase
      .from("team_members")
      .select("team_id")
      .maybeSingle();
    return data ? next : "/onboarding";
  }

  if (code) {
    // PKCE flow
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${await destination()}`);
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email",
    });
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${await destination()}`);
    }
  }

  // Exchange failed (expired/reused link) — send them to sign in with context
  // instead of silently dropping them on the dashboard.
  return NextResponse.redirect(`${siteUrl}/login?error=confirm`);
}
