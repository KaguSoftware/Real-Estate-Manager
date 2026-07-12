// Standard sales-agreement clauses (Turkish).
// {placeholders}: sale_price, currency, penalty_amount, deposit_amount,
//                 target_close_date, validity_days, tax_responsibility_clause,
//                 agency_name, jurisdiction_city.

export { interpolate } from "./interpolate";

export const SALES_STANDARD_CLAUSES = [
	// 1
	"SATICI ile ALICI, yukarıda kayıtlı Gayrimenkulün, aşağıdaki maddelerde belirlenen koşullarda satışı için anlaşmışlardır.",
	// 2
	"SATICI, yukarıda yazılı Gayrimenkulü {sale_price} {currency}'ye satmayı kabul etmiştir.",
	// 3
	"ALICI, yukarıda yazılı Gayrimenkulü {sale_price} {currency}'ye satın almayı kabul etmiştir.",
	// 4 — penalty + agency-fee due regardless
	"ALICI veya SATICI iş bu sözleşmeden vazgeçtiği takdirde, haksız olarak sözleşmeyi fesheden taraf diğer tarafa {penalty_amount} {currency} tutarında cezai şart ödemeyi kabul, taahhüt ve beyan eder. Sözleşmenin herhangi bir sebeple feshedilmesi halinde bile {agency_name}'a ait hizmet bedelinin eksiksiz olarak ödeneceğini ALICI ve SATICI peşinen kabul, taahhüt ve beyan eder.",
	// 5 — tax responsibility, resolved at build time
	"İşbu gayrimenkulün satışı aşamasında her türlü harç, vergi ve diğer gider kalemleri {tax_responsibility_clause}",
	// 6
	"Gayrimenkulün satış tarihine kadar olabilecek eski vergi ve borçları (Emlak-Çevre-Çöp Vergisi, Elektrik-Su-Telefon-Doğalgaz borçları, Site/Bina Aidatı, Haciz, İpotek vb.) tamamen SATICI'nın sorumluluğundadır. ALICI bu borçlar için sorumluluk kabul etmez. Satış tarihinden sonraki borçlar ALICI'ya aittir.",
	// 7
	"Gayrimenkul üzerindeki tüm kısıtlamaların SATICI tarafından kaldırılmaması veya herhangi bir nedenle kaldırılamaması durumunda ALICI işbu sözleşmeyi tek taraflı olarak fesh etme hakkına sahiptir. SATICI, alıcının bu tek taraflı fesh etme hakkını peşinen kabul, taahhüt ve beyan eder.",
	// 8
	"SATICI iş bu protokolün yapıldığı tarihten itibaren Gayrimenkul üzerinde hiçbir tasarrufta bulunamaz ve tapu devri yapılıncaya kadar başka birine satamaz.",
	// 9
	"SATICI, ALICI tarafından satım bedelinin ödenmesiyle birlikte adına olan sözleşmeye konu gayrimenkulün ALICI adına tescili için tapuda satış işlemlerini gerçekleştirecek ve gayrimenkulün ALICI adına tescilini sağlayacaktır.",
	// 10
	"Satış işlemi en geç {target_close_date} tarihine kadar gerçekleşecektir.",
	// 11
	"SATICI satış bedeline mahsuben ALICI'dan kaparo (Pişmanlık Akçesi / Cayma Tazminatı) olarak {deposit_amount} {currency} tutarında teminat bedeli alacaktır. Bu meblağ SATICI'nın veya {agency_name}'a ait banka hesabına yatırılacak ya da elden makbuz karşılığı verilecektir.",
	// 12
	"SATICI, kalan bakiyenin ödenmesi halinde tapu işlemlerinin gerçekleştirilmesini sağlayacaktır. Satış bedelinin ödenmemesi halinde SATICI sözleşmeyi tek taraflı olarak feshedebilir.",
	// 13
	"İlgili protokol şartlarını ALICI yerine getiremez, protokol şartlarına uymaz veya almaktan vazgeçtiği takdirde Borçlar Kanunu'nun 156/2. maddesine göre SATICI kaporayı iade etmek zorunda değildir.",
	// 14
	"SATICI gayrimenkulünü satmaktan vazgeçerse kaparoyu iade edeceği gibi ALICI'nın uğramış olduğu zararları karşılamakla yükümlüdür.",
	// 15
	"Anlaşmazlık halinde, haksız olan taraf, bu sözleşmede yazılı pişmanlık akçesi ile birlikte; diğer tarafın maruz kalacağı her nevi zarar, ziyan, mahkeme ve icra masrafları, vekâlet ücretleri ve danışmanlık firmasının hizmet bedelini de ödeyecektir.",
	// 16
	"Protokol süresinin geçerliliği imzalandığı tarihten itibaren {validity_days} gündür. Bu süre sonunda gayrimenkulün tapu devir işlemi sonuçlandırılamazsa iş bu protokol şartları geçerlidir. Bu sözleşmenin uygulamasından doğabilecek her türlü uyuşmazlığın giderilmesinde {jurisdiction_city} mahkemeleri ve icra daireleri yetkilidir.",
];

/** Resolves clause 5's {tax_responsibility_clause} placeholder. */
export const TAX_RESPONSIBILITY_CLAUSES: Record<"buyer" | "seller" | "legal", string> = {
	buyer:  "ALICI tarafından ödenecektir.",
	seller: "SATICI tarafından ödenecektir.",
	legal:  "tarafların yasal sorumlulukları çerçevesinde ödenecektir.",
};
