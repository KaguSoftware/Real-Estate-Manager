/**
 * Gizlilik Politikası — public legal page (linked from signup + footer).
 * NOT: Bu metin bir şablondur; yayına almadan önce bir avukata inceletin
 * (bkz. LAUNCH_RUNBOOK.md). Köşeli parantezli alanları doldurun.
 */

import type { Metadata } from "next";
import { PublicShell, LegalArticle } from "@/src/components/marketing/PublicShell";

export const metadata: Metadata = {
	title: "Gizlilik Politikası — Kagu Emlak",
	description: "Kagu Emlak gizlilik politikası: hangi verileri neden topluyoruz, nasıl saklıyoruz.",
};

export default function PrivacyPage() {
	return (
		<PublicShell>
			<LegalArticle title="Gizlilik Politikası" updated="11.07.2026">
				<p>
					Bu politika, [ŞİRKET UNVANI] (&quot;Kagu&quot;) tarafından sunulan Kagu Emlak
					hizmetinde hangi verilerin, hangi amaçlarla işlendiğini ve nasıl korunduğunu
					açıklar. Kişisel verilerin işlenmesine ilişkin ayrıntılı bilgilendirme için{" "}
					<a href="/kvkk-aydinlatma" className="underline">KVKK Aydınlatma Metni</a>&apos;ne bakın.
				</p>

				<h2>Topladığımız Veriler</h2>
				<ul>
					<li>
						<strong>Hesap verileri:</strong> ad soyad, e-posta, telefon; ekip adı ve
						ofis bilgileri.
					</li>
					<li>
						<strong>İş verileri:</strong> Hizmete sizin girdiğiniz portföy, müşteri,
						kiracı, sözleşme ve tahsilat kayıtları. Bu kayıtlar üçüncü kişilere ait
						kişisel veriler (ör. kiracı kimlik ve iletişim bilgileri) içerebilir; bu
						verilerin hukuka uygun toplanmasından veri sorumlusu sıfatıyla ekip
						sahibi sorumludur.
					</li>
					<li>
						<strong>Teknik veriler:</strong> oturum çerezleri (kimlik doğrulama için
						zorunlu), hata kayıtları ve temel kullanım günlükleri.
					</li>
				</ul>

				<h2>Verileri Nasıl Kullanıyoruz</h2>
				<ul>
					<li>Hizmeti sunmak, hesabınızı doğrulamak ve destek sağlamak için.</li>
					<li>Abonelik ve faturalandırma işlemlerini yürütmek için.</li>
					<li>Hataları tespit edip gidermek ve güvenliği sağlamak için.</li>
					<li>
						Verilerinizi <strong>reklam amacıyla satmayız, kiralamayız ve
						paylaşmayız.</strong>
					</li>
				</ul>

				<h2>Saklama ve Güvenlik</h2>
				<ul>
					<li>
						Veriler, Supabase altyapısında (PostgreSQL) şifreli bağlantılar (TLS)
						üzerinden ve erişim kontrolü (satır düzeyi güvenlik) ile saklanır.
						Barındırma bölgesi: [AB — Frankfurt / yourregion].
					</li>
					<li>
						Ödeme işlemleri iyzico tarafından gerçekleştirilir; kart bilgileriniz
						sistemlerimizde saklanmaz.
					</li>
					<li>
						Hata ayıklama hizmeti (Sentry) kişisel içerik gönderilmeyecek şekilde
						yapılandırılmıştır.
					</li>
					<li>Hesap veya ekip silindiğinde ilişkili veriler kalıcı olarak silinir.</li>
				</ul>

				<h2>Çerezler</h2>
				<p>
					Yalnızca oturumunuzu güvenle sürdürmek için zorunlu kimlik doğrulama
					çerezleri ve tema tercihiniz gibi yerel tercihler kullanılır. Reklam veya
					üçüncü taraf takip çerezi kullanılmaz.
				</p>

				<h2>Haklarınız</h2>
				<p>
					Verilerinize erişme, düzeltme, silme ve taşıma (CSV dışa aktarma) haklarınızı
					Hizmet içinden veya <a href="mailto:[E-POSTA]" className="underline">[E-POSTA]</a>{" "}
					adresine yazarak kullanabilirsiniz. Ayrıntılar için KVKK Aydınlatma
					Metni&apos;ne bakın.
				</p>

				<h2>İletişim</h2>
				<p>
					[ŞİRKET UNVANI] — [ADRES] — <a href="mailto:[E-POSTA]" className="underline">[E-POSTA]</a>
				</p>
			</LegalArticle>
		</PublicShell>
	);
}
