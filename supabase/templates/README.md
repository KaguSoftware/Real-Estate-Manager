# Auth email templates

Branded replacements for Supabase's default auth emails. Supabase stores these in the
project dashboard, not in the repo, so they must be pasted in manually.

## How to install

Supabase Dashboard → **Authentication → Email Templates**, then for each template paste
the corresponding file's full HTML into the *Message body* and set the subject:

| Dashboard template   | File                  | Subject                                    |
| -------------------- | --------------------- | ------------------------------------------ |
| Confirm signup       | `confirm-signup.html` | Confirm your email — Kagu Real Estate      |
| Magic Link           | `magic-link.html`     | Your sign-in link — Kagu Real Estate       |
| Reset Password       | `reset-password.html` | Reset your password — Kagu Real Estate     |
| Change Email Address | `change-email.html`   | Confirm your new email — Kagu Real Estate  |

## Fix the localhost links (required)

Dashboard → **Authentication → URL Configuration**:

1. **Site URL** → your production domain (e.g. `https://your-domain.com`).
   This is what `{{ .ConfirmationURL }}` builds links from — while it is
   `http://localhost:3000`, every email links to localhost.
2. **Redirect URLs** → add both:
   - `https://your-domain.com/auth/callback`
   - `http://localhost:3000/auth/callback` (keeps local dev working)
3. Set `NEXT_PUBLIC_SITE_URL` in the app's env (see `.env.example`) to the same domain.

## Making it look even less "scammy"

The sender is still `noreply@mail.app.supabase.io`, which is the single biggest trust
problem. To send from your own domain, configure **custom SMTP** (Dashboard →
Project Settings → Auth → SMTP) with a provider such as Resend or Postmark and a
verified sending domain (SPF + DKIM). The templates above work unchanged.
