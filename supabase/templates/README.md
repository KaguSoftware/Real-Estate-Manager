# Auth e-posta şablonları

Branded replacements for Supabase's default auth emails, styled to match the in-app
transactional emails in `src/lib/email.ts` (Kagu · Emlak Yönetim Sistemi — background
`#f2f0ec`, white card, `#b74427` buttons, Turkish copy). Supabase stores these in the
project dashboard, not in the repo, so they must be pasted in manually.

## How to install

Supabase Dashboard → **Authentication → Emails → Templates**, then for each template
paste the corresponding file's full HTML into the *Message body* and set the subject:

| Dashboard template   | File                  | Önerilen konu (subject)                     |
| -------------------- | --------------------- | ------------------------------------------- |
| Confirm signup       | `confirm-signup.html` | E-posta adresinizi doğrulayın — Kagu        |
| Magic Link           | `magic-link.html`     | Giriş bağlantınız — Kagu                    |
| Reset Password       | `reset-password.html` | Şifrenizi sıfırlayın — Kagu                 |
| Change Email Address | `change-email.html`   | Yeni e-posta adresinizi onaylayın — Kagu    |
| Invite user          | `invite.html`         | Kagu'da bir ekibe davet edildiniz           |

All templates use `{{ .ConfirmationURL }}`; `change-email.html` additionally uses
`{{ .Email }}` and `{{ .NewEmail }}`.

## Fix the localhost links (required)

Dashboard → **Authentication → URL Configuration**:

1. **Site URL** → your production domain (e.g. `https://your-domain.com`).
   This is what `{{ .ConfirmationURL }}` builds links from — while it is
   `http://localhost:3000`, every email links to localhost.
2. **Redirect URLs** → add both:
   - `https://your-domain.com/auth/callback`
   - `http://localhost:3000/auth/callback` (keeps local dev working)
3. Set `NEXT_PUBLIC_SITE_URL` in the app's env (see `.env.example`) to the same domain.

## Custom SMTP / verified sender (recommended)

By default these mails come from `noreply@mail.app.supabase.io`, which is the single
biggest "looks like a scam" signal. To send from a Kagu domain:

1. Verify a sending domain (SPF + DKIM) with a provider such as Resend or Postmark.
2. Dashboard → **Project Settings → Auth → SMTP**: enable custom SMTP with that
   provider's credentials and a sender like `Kagu <bildirim@kagu.app>`.
3. The templates above work unchanged.

Note: the app also sends its own transactional mail outside Supabase Auth —
`src/lib/email.ts` sends the in-app team invite (for users who already have an
account) via the Resend API. That path uses two env vars:

- `RESEND_API_KEY` — required to actually send (otherwise sends are skipped).
- `EMAIL_FROM` — the verified sender, e.g. `Kagu <bildirim@kagu.app>`.

Use the same verified domain for both SMTP and `EMAIL_FROM` so every Kagu email
arrives from one consistent, trusted address.
