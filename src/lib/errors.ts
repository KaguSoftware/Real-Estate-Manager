// Map raw Supabase/Postgres errors to messages a non-technical user can act on.

import { useAppStore } from "@/src/store";
import { reportError } from "./reportError";

interface PgLikeError {
	code?: string;
	message?: string;
}

/** True when the failure is most plausibly the trial/subscription write lock:
 *  an RLS rejection while the client already knows the team isn't writable. */
function isPaywallError(code: string | undefined, raw: string): boolean {
	const rlsHit = code === "42501" || /row-level security/i.test(raw);
	if (!rlsHit) return false;
	const team = useAppStore.getState().team;
	return team !== null && !team.is_writable;
}

export function humanizeError(e: unknown): string {
	const err = (typeof e === "object" && e !== null ? e : {}) as PgLikeError;
	const raw = err.message ?? (e instanceof Error ? e.message : String(e));

	if (isPaywallError(err.code, raw)) {
		return "Ekibinizin deneme süresi sona erdi — bir plan etkinleştirilene kadar çalışma alanı salt okunur. Abonelik sayfasına bakın.";
	}

	switch (err.code) {
		case "23503": // foreign key violation
			return "Bu kayıt hâlâ başka verilerle bağlantılı (örneğin bir kira sözleşmesi veya ödeme). Önce onları kaldırın.";
		case "23505": // unique violation
			if (raw.includes("uniq_active_lease_per_property"))
				return "Bu taşınmazın zaten aktif bir kira sözleşmesi var. Yenisini oluşturmadan önce mevcut sözleşmeyi sonlandırın.";
			return "Bu bilgilerle bir kayıt zaten mevcut.";
		case "23514": // check constraint
			return "Değerlerden biri izin verilen aralığın dışında. Lütfen formu gözden geçirin.";
		case "42501": // insufficient privilege / RLS
		case "PGRST301":
			// Owners hitting this on paths they should have access to is a bug in
			// our policies or seed data, not user error — surface the raw denial.
			reportError(e);
			return "Bu işlem için yetkiniz yok.";
	}

	// Domain RPC errors (raised in migrations — keep the regexes in sync).
	if (/seat limit/i.test(raw))
		return "Planınızın danışman sınırına ulaştınız — daha fazla üye eklemek için planınızı yükseltin.";
	if (/transfer ownership or delete/i.test(raw))
		return "Önce ekip sahipliğini devredin veya ekibi silin.";
	if (/already belong to a team/i.test(raw) || /already_in_team/i.test(raw))
		return "Zaten başka bir ekibe üyesiniz. Bu ekibe katılmak için önce mevcut ekibinizden ayrılın.";
	if (/invite_email_mismatch/i.test(raw))
		return "Bu davet başka bir e-posta adresine gönderilmiş. Davetin geldiği e-posta adresiyle giriş yapın veya ekip sahibinden bu adrese yeni bir davet isteyin.";
	if (/invalid or expired invite/i.test(raw) || /invite_invalid/i.test(raw))
		return "Davet kodu geçersiz veya süresi dolmuş. Ekip sahibinden yeni bir davet isteyin.";

	// Supabase Auth error strings.
	if (/invalid login credentials/i.test(raw)) return "E-posta veya şifre hatalı. Lütfen tekrar deneyin.";
	if (/email not confirmed/i.test(raw))
		return "E-posta adresiniz henüz doğrulanmadı — onay bağlantısı için gelen kutunuzu kontrol edin.";
	if (/user already registered/i.test(raw))
		return "Bu e-posta ile kayıtlı bir hesap zaten var. Bunun yerine giriş yapmayı deneyin.";
	if (/password should be/i.test(raw))
		return "Şifre çok zayıf — en az 6 karakter kullanın.";
	if (/rate limit|too many requests|security purposes/i.test(raw))
		return "Çok fazla deneme yapıldı — lütfen bir dakika bekleyip tekrar deneyin.";
	if (/invalid email/i.test(raw)) return "Bu geçerli bir e-posta adresine benzemiyor.";

	if (/JWT|token|not authenticated/i.test(raw)) return "Oturumunuzun süresi doldu — lütfen tekrar giriş yapın.";
	if (/Failed to fetch|NetworkError|fetch failed/i.test(raw))
		return "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.";
	if (/row-level security/i.test(raw)) {
		reportError(e);
		return "Bu işlem için yetkiniz yok.";
	}

	// Nothing matched — this is an unexpected failure. Report it (Sentry when
	// configured) before showing the generic fallback so prod breakage surfaces
	// to us, not only to customers.
	reportError(e);
	return raw || "Bir şeyler ters gitti. Lütfen tekrar deneyin.";
}
