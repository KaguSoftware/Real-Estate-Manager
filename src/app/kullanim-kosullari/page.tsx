/**
 * Kullanım Koşulları — public legal page (linked from signup + footer).
 * NOT: Bu metin bir şablondur; yayına almadan önce bir avukata inceletin
 * (bkz. LAUNCH_RUNBOOK.md). Köşeli parantezli alanları şirket bilgilerinizle
 * doldurun.
 */

import type { Metadata } from "next";
import { PublicShell, LegalArticle } from "@/src/components/marketing/PublicShell";

export const metadata: Metadata = {
	title: "Kullanım Koşulları — Kagu Emlak",
	description: "Kagu Emlak hizmet kullanım koşulları.",
};

export default function TermsPage() {
	return (
		<PublicShell>
			<LegalArticle title="Kullanım Koşulları" updated="11.07.2026">
				<p>
					Bu Kullanım Koşulları (&quot;Koşullar&quot;), [ŞİRKET UNVANI] (&quot;Kagu&quot;,
					&quot;biz&quot;) tarafından sunulan Kagu Emlak yazılım hizmetinin
					(&quot;Hizmet&quot;) kullanımını düzenler. Hizmete kaydolarak veya Hizmeti
					kullanarak bu Koşulları kabul etmiş sayılırsınız.
				</p>

				<h2>1. Hizmetin Tanımı</h2>
				<p>
					Kagu Emlak; emlak ofisleri için portföy yönetimi, müşteri takibi (CRM),
					kiracı ve tahsilat yönetimi ile sözleşme belgesi oluşturma araçları sunan,
					abonelik esaslı bir bulut yazılımıdır (SaaS).
				</p>

				<h2>2. Hesap ve Ekip</h2>
				<ul>
					<li>Hesap açarken doğru ve güncel bilgi vermekle yükümlüsünüz.</li>
					<li>Hesap kimlik bilgilerinizin gizliliğinden siz sorumlusunuz.</li>
					<li>
						Ekip sahibi, ekibine davet ettiği kullanıcıların Hizmet üzerindeki
						eylemlerinden ve ekip verilerinin yönetiminden sorumludur.
					</li>
				</ul>

				<h2>3. Abonelik, Deneme Süresi ve Ödeme</h2>
				<ul>
					<li>Hizmet, 14 günlük ücretsiz deneme süresi ile başlar; kredi kartı gerekmez.</li>
					<li>
						Deneme süresi sonunda etkin bir abonelik başlatılmazsa çalışma alanınız
						salt okunur duruma geçer; verileriniz silinmez.
					</li>
					<li>
						Abonelik ücretleri aylık olarak tahsil edilir. Güncel fiyatlar Hizmet
						içindeki Abonelik sayfasında ilan edilir. Fiyat değişiklikleri bir sonraki
						fatura döneminden itibaren geçerli olur ve önceden duyurulur.
					</li>
					<li>
						Aboneliğinizi dilediğiniz zaman iptal edebilirsiniz; erişiminiz ödenmiş
						dönemin sonuna kadar devam eder.
					</li>
				</ul>

				<h2>4. Veriler ve Fikri Mülkiyet</h2>
				<ul>
					<li>
						Hizmete girdiğiniz tüm veriler (portföy, müşteri, kiracı, sözleşme
						kayıtları) size aittir. Verilerinizi CSV olarak dışa aktarabilirsiniz.
					</li>
					<li>
						Hizmetin yazılımı, tasarımı ve markası Kagu&apos;ya aittir; size yalnızca
						abonelik süresince sınırlı, devredilemez bir kullanım hakkı tanınır.
					</li>
					<li>
						Kişisel verilerin işlenmesine ilişkin esaslar{" "}
						<a href="/kvkk-aydinlatma" className="underline">KVKK Aydınlatma Metni</a>{" "}
						ve <a href="/gizlilik-politikasi" className="underline">Gizlilik Politikası</a>&apos;nda düzenlenir.
					</li>
				</ul>

				<h2>5. Kabul Edilebilir Kullanım</h2>
				<ul>
					<li>Hizmet yalnızca hukuka uygun amaçlarla kullanılabilir.</li>
					<li>
						Hizmete yetkisiz erişim denemesi, tersine mühendislik, aşırı otomatik
						sorgu ve üçüncü kişilerin haklarını ihlal eden içerik yüklenmesi yasaktır.
					</li>
					<li>
						Sözleşme belgeleri şablon niteliğindedir; hukuki geçerliliklerinin
						teyidi kullanıcının sorumluluğundadır.
					</li>
				</ul>

				<h2>6. Hizmet Seviyesi ve Sorumluluğun Sınırlandırılması</h2>
				<ul>
					<li>
						Hizmeti kesintisiz sunmak için makul çabayı gösteririz; planlı bakımlar
						önceden duyurulur. Hizmet &quot;olduğu gibi&quot; sunulur.
					</li>
					<li>
						Kagu&apos;nun sorumluluğu, her durumda son 12 ayda ödediğiniz abonelik
						bedelinin toplamı ile sınırlıdır. Dolaylı zararlardan sorumluluk kabul
						edilmez.
					</li>
				</ul>

				<h2>7. Fesih</h2>
				<ul>
					<li>
						Hesabınızı ve ekibinizi dilediğiniz zaman Hizmet içinden silebilirsiniz;
						silme işlemi geri alınamaz.
					</li>
					<li>
						Bu Koşulların ağır ihlali hâlinde hesabınızı askıya alma veya feshetme
						hakkımız saklıdır.
					</li>
				</ul>

				<h2>8. Değişiklikler ve Uygulanacak Hukuk</h2>
				<p>
					Bu Koşullar güncellenebilir; önemli değişiklikler Hizmet içinden duyurulur.
					İşbu Koşullar Türkiye Cumhuriyeti hukukuna tabidir; uyuşmazlıklarda
					[ŞEHİR] mahkemeleri ve icra daireleri yetkilidir.
				</p>

				<h2>İletişim</h2>
				<p>
					[ŞİRKET UNVANI] — [ADRES] — <a href="mailto:[E-POSTA]" className="underline">[E-POSTA]</a>
				</p>
			</LegalArticle>
		</PublicShell>
	);
}
