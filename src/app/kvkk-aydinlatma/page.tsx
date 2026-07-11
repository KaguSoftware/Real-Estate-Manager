/**
 * KVKK Aydınlatma Metni — 6698 sayılı KVKK md. 10 kapsamında bilgilendirme.
 * NOT: Bu metin bir şablondur; yayına almadan önce bir avukata inceletin
 * (bkz. LAUNCH_RUNBOOK.md). Köşeli parantezli alanları doldurun.
 */

import type { Metadata } from "next";
import { PublicShell, LegalArticle } from "@/src/components/marketing/PublicShell";

export const metadata: Metadata = {
	title: "KVKK Aydınlatma Metni — Kagu Emlak",
	description: "6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma metni.",
};

export default function KvkkPage() {
	return (
		<PublicShell>
			<LegalArticle title="Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni" updated="11.07.2026">
				<p>
					İşbu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;)
					m. 10 uyarınca, veri sorumlusu sıfatıyla hareket eden{" "}
					<strong>[ŞİRKET UNVANI]</strong> (&quot;Kagu&quot;) tarafından, Kagu Emlak
					hizmetinin kullanıcılarını bilgilendirmek amacıyla hazırlanmıştır.
				</p>

				<h2>1. Veri Sorumlusu</h2>
				<p>
					[ŞİRKET UNVANI] — Mersis No: [MERSİS] — Adres: [ADRES] — E-posta:{" "}
					<a href="mailto:[E-POSTA]" className="underline">[E-POSTA]</a>
				</p>

				<h2>2. İşlenen Kişisel Veriler</h2>
				<ul>
					<li>
						<strong>Kullanıcı verileri:</strong> kimlik (ad soyad), iletişim
						(e-posta, telefon), hesap ve işlem güvenliği verileri (oturum kayıtları).
					</li>
					<li>
						<strong>Müşteri/kiracı kayıtları:</strong> Hizmeti kullanan emlak ofisinin
						sisteme girdiği üçüncü kişilere ait kimlik, iletişim, T.C. kimlik/vergi
						numarası ve sözleşme verileri. Bu veriler bakımından{" "}
						<strong>veri sorumlusu ilgili emlak ofisidir</strong>; Kagu, KVKK
						anlamında veri işleyen sıfatıyla hareket eder.
					</li>
					<li>
						<strong>Finansal veriler:</strong> abonelik ve fatura bilgileri (ödeme
						kartı verileri iyzico&apos;da tutulur, Kagu sistemlerinde saklanmaz).
					</li>
				</ul>

				<h2>3. İşleme Amaçları ve Hukuki Sebepler</h2>
				<ul>
					<li>
						Hizmet sözleşmesinin kurulması ve ifası (KVKK m. 5/2-c): hesap açılışı,
						hizmetin sunulması, faturalandırma.
					</li>
					<li>
						Hukuki yükümlülüklerin yerine getirilmesi (m. 5/2-ç): mali mevzuat,
						saklama yükümlülükleri.
					</li>
					<li>
						Meşru menfaat (m. 5/2-f): hizmet güvenliği, hata tespiti, kötüye
						kullanımın önlenmesi.
					</li>
				</ul>

				<h2>4. Aktarım</h2>
				<p>
					Kişisel veriler; barındırma hizmeti için Supabase ([BÖLGE — ör. AB/Frankfurt]
					veri merkezleri), ödeme için iyzico Ödeme Hizmetleri A.Ş., e-posta iletimi
					için [SMTP SAĞLAYICISI — ör. Resend] ve hata izleme için Sentry (kişisel
					içerik gönderilmeyecek yapılandırma ile) hizmet sağlayıcılarına, hizmetin
					gerektirdiği ölçüde aktarılır. Yurt dışına aktarım, KVKK m. 9 kapsamındaki
					şartlara uygun olarak yürütülür.
				</p>

				<h2>5. Saklama Süresi</h2>
				<p>
					Veriler, üyelik süresince ve ilgili mevzuattaki zamanaşımı/saklama süreleri
					boyunca saklanır. Hesap veya ekip silindiğinde, yasal saklama yükümlülüğüne
					tabi olmayan veriler kalıcı olarak silinir.
				</p>

				<h2>6. KVKK m. 11 Kapsamındaki Haklarınız</h2>
				<ul>
					<li>Kişisel verilerinizin işlenip işlenmediğini öğrenme ve bilgi talep etme,</li>
					<li>İşleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
					<li>Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme,</li>
					<li>KVKK m. 7 çerçevesinde silinmesini veya yok edilmesini isteme,</li>
					<li>Aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
					<li>Münhasıran otomatik sistemlerce analiz sonucu aleyhe çıkan sonuçlara itiraz etme,</li>
					<li>Kanuna aykırı işleme nedeniyle doğan zararın giderilmesini talep etme.</li>
				</ul>
				<p>
					Taleplerinizi <a href="mailto:[E-POSTA]" className="underline">[E-POSTA]</a>{" "}
					adresine iletebilirsiniz; başvurular en geç 30 gün içinde ücretsiz olarak
					sonuçlandırılır. Ayrıca hesabınızı ve ekip verilerinizi Hizmet içinden
					(Profil → Hesabımı sil / Ekip → Ekibi sil) doğrudan silebilirsiniz.
				</p>
			</LegalArticle>
		</PublicShell>
	);
}
