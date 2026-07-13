// Server-only transactional email via the Resend REST API (no SDK dependency).
//
// Auth emails (confirm/magic-link/reset) still go through Supabase Auth with
// the branded templates in supabase/templates/. This module covers emails
// Supabase can't send — e.g. inviting a user who already has an account.
//
// Env:
//   RESEND_API_KEY — required to actually send; without it sends are skipped
//                    (callers treat that as "not emailed", never an error).
//   EMAIL_FROM     — verified sender, e.g. "Kagu <bildirim@kagu.app>".
//                    Defaults to Resend's shared test sender.

const FROM = process.env.EMAIL_FROM || "Kagu <onboarding@resend.dev>";

interface SendResult {
	sent: boolean;
	error?: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
	const key = process.env.RESEND_API_KEY;
	if (!key) return { sent: false, error: "RESEND_API_KEY not configured" };
	try {
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({ from: FROM, to: [to], subject, html }),
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			return { sent: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
		}
		return { sent: true };
	} catch (e) {
		return { sent: false, error: e instanceof Error ? e.message : String(e) };
	}
}

/** Shared shell for all Kagu emails: brand header, card body, quiet footer. */
function emailLayout(bodyHtml: string): string {
	return `<!doctype html>
<html lang="tr">
<body style="margin:0;padding:0;background-color:#f2f0ec;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f0ec;padding:32px 16px;">
		<tr><td align="center">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
				<tr><td style="padding:0 8px 16px;">
					<span style="font-size:20px;font-weight:800;color:#1e242e;letter-spacing:-0.02em;">Kagu</span>
					<span style="font-size:12px;color:#8b929e;"> · Emlak Yönetim Sistemi</span>
				</td></tr>
				<tr><td style="background:#ffffff;border-radius:16px;padding:32px 28px;border:1px solid #e6e2da;">
					${bodyHtml}
				</td></tr>
				<tr><td style="padding:16px 8px 0;">
					<p style="margin:0;font-size:12px;color:#8b929e;line-height:1.5;">
						Bu e-posta Kagu Emlak Yönetim Sistemi tarafından gönderildi.
						Bu daveti siz talep etmediyseniz güvenle yok sayabilirsiniz.
					</p>
				</td></tr>
			</table>
		</td></tr>
	</table>
</body>
</html>`;
}

/** Team invite for a user who already has a Kagu account. */
export async function sendTeamInviteEmail(opts: {
	to: string;
	teamName: string;
	inviterName?: string | null;
	joinUrl: string;
}): Promise<SendResult> {
	const { to, teamName, inviterName, joinUrl } = opts;
	const inviter = inviterName?.trim();
	const body = `
		<h1 style="margin:0 0 12px;font-size:20px;color:#1e242e;">${escapeHtml(teamName)} ekibine davet edildiniz</h1>
		<p style="margin:0 0 20px;font-size:15px;color:#4b5158;line-height:1.6;">
			${inviter ? `<strong>${escapeHtml(inviter)}</strong> sizi` : "Sizi"} Kagu üzerindeki
			<strong>${escapeHtml(teamName)}</strong> ekibine danışman olarak katılmaya davet etti.
			Mevcut hesabınızla giriş yaparak daveti kabul edebilirsiniz.
		</p>
		<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:#b74427;">
			<a href="${joinUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
				Daveti kabul et
			</a>
		</td></tr></table>
		<p style="margin:20px 0 0;font-size:13px;color:#8b929e;line-height:1.6;">
			Buton çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:<br>
			<a href="${joinUrl}" style="color:#b74427;word-break:break-all;">${joinUrl}</a>
		</p>`;
	return sendEmail(to, `${teamName} ekibine davet edildiniz — Kagu`, emailLayout(body));
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
