/**
 * /auth/callback — handles the magic-link redirect from Supabase.
 *
 * Supabase appends `code` (PKCE) or `token_hash` + `type` (OTP/magic-link)
 * query params when redirecting here after the user clicks the email link.
 * We exchange the code/token for a session and redirect the user back to the app.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as string | null;
  const next = searchParams.get("next") ?? "/";

  // Use NEXT_PUBLIC_SITE_URL if set (production), otherwise fall back to request origin.
  // This avoids http:// vs https:// mismatches on Vercel.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    request.nextUrl.origin;

  const supabase = await createClient();

  if (code) {
    // PKCE flow
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email",
    });
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/`);
}
