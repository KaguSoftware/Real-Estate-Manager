// Standard residential-lease clauses (Turkish — konut kira sözleşmesi).
// {placeholder} tokens are resolved by interpolate() (../interpolate) against
// the lease values at render time. Editing this file is the single source of
// truth for the boilerplate legal copy.
//
// Placeholders used below:
//   monthly_rent, deposit, currency, start_date, payment_day,
//   utilities_summary, subletting_clause, rent_increase_clause, notice_days
//
// The legal copy deliberately references Türk Borçlar Kanunu (TBK) rather than
// hard-coding figures that mandatory tenant-protection rules may override
// (e.g. the rent-increase cap is expressed as "TÜFE oranını aşmayacak şekilde",
// not a fixed percentage).

import type { UtilityResponsibility } from "@/src/lib/db/types";

export { interpolate } from "./interpolate";

export const RENTAL_STANDARD_CLAUSES = [
	// 1 — Rent amount, due day, late payment
	"Aylık kira bedeli {monthly_rent} {currency} olup, her ayın {payment_day}. günü peşin olarak ödenecektir. Kira bedelinin zamanında ödenmemesi halinde KİRACI, Türk Borçlar Kanunu'nun ilgili hükümleri uyarınca temerrüde düşmüş sayılır.",
	// 2 — Deposit, legal cap, refund
	"KİRACI tarafından KİRAYA VEREN'e {deposit} {currency} tutarında güvence (depozito) bedeli verilmiştir. Türk Borçlar Kanunu m.342 uyarınca güvence bedeli üç aylık kira bedelini aşamaz. Depozito, kira ilişkisinin sona ermesi ve taşınmazın hasarsız teslimi halinde, olağan kullanımdan doğan yıpranma dışındaki zararlar mahsup edilerek KİRACI'ya iade edilir.",
	// 3 — Use of the property
	"KİRACI, kiralananı yalnızca konut olarak kullanacak, sözleşmeye ve dürüstlük kurallarına uygun şekilde, özenle kullanmakla yükümlüdür.",
	// 4 — Utilities (resolved at build time)
	"Aboneliklere ilişkin masrafların sorumluluğu şu şekildedir: {utilities_summary} Aksi belirtilmedikçe abonelik bedelleri ilgili tarafça ödenir.",
	// 5 — Subletting (resolved at build time)
	"{subletting_clause}",
	// 6 — Maintenance split
	"Kiralananın olağan kullanımından kaynaklanan küçük onarım ve bakımlar KİRACI'ya aittir. Yapısal sorunlar, çatı, tesisat ve elektrik sistemine ilişkin esaslı onarımlar ile KİRACI'nın kusuru olmaksızın ortaya çıkan büyük arızalar KİRAYA VEREN'in sorumluluğundadır. KİRACI, onarım gerektiren durumları makul süre içinde KİRAYA VEREN'e yazılı olarak bildirir.",
	// 7 — Alterations / fixtures / restoration
	"KİRACI, KİRAYA VEREN'in yazılı izni olmaksızın kiralananda tadilat yapamaz, sabit tesisat ekleyemez veya kaldıramaz. Sözleşme sonunda kiralanan, teslim alındığı durumda (olağan yıpranma hariç) ve demirbaş listesiyle birlikte eksiksiz teslim edilir.",
	// 8 — Rent increase (resolved at build time)
	"{rent_increase_clause}",
	// 9 — Access / inspection rights
	"KİRAYA VEREN, makul saatlerde ve en az {notice_days} gün önceden KİRACI'ya bildirimde bulunmak kaydıyla kiralananı denetleyebilir. Acil durumlarda (yangın, su baskını, can ve mal güvenliğini tehdit eden haller) önceden bildirim koşulu aranmaz.",
	// 10 — Termination / notice
	"Sözleşmenin feshi ve tahliyeye ilişkin ihbar süreleri ile koşullar Türk Borçlar Kanunu hükümlerine tabidir. Belirli süreli kira sözleşmeleri, ancak tarafların yazılı mutabakatı veya kanunda öngörülen haklı sebeplerle erken feshedilebilir.",
	// 11 — Governing law / jurisdiction
	"İşbu sözleşmeden doğabilecek uyuşmazlıklarda taşınmazın bulunduğu yer mahkemeleri ve icra daireleri yetkilidir. Sözleşmede hüküm bulunmayan hallerde Türk Borçlar Kanunu ve ilgili mevzuat uygulanır.",
];

/** Default notice period (days) used in the access clause. */
export const RENTAL_NOTICE_DAYS = 3;

/** Resolves clause 5's {subletting_clause} placeholder. */
export const SUBLETTING_CLAUSES: Record<"true" | "false", string> = {
	true: "KİRACI, KİRAYA VEREN'in yazılı onayını almak kaydıyla kiralananı alt kiraya verebilir veya kullanım hakkını devredebilir.",
	false:
		"KİRACI, KİRAYA VEREN'in yazılı izni olmaksızın kiralananı alt kiraya veremez, başkasına devredemez ve kullanımını üçüncü kişilere bırakamaz.",
};

/** Default rent-increase clause (used when no override note is supplied). */
export const RENT_INCREASE_DEFAULT_CLAUSE =
	"Kira bedeli her yenileme döneminde, Türk Borçlar Kanunu m.344 uyarınca bir önceki kira yılına ait tüketici fiyat endeksindeki (TÜFE) on iki aylık ortalamalara göre değişim oranını aşmayacak şekilde artırılır. Bu sınırı aşan artış anlaşmaları geçersizdir.";

/** Per-utility responsibility label (Turkish). */
export const UTILITY_RESP_LABELS: Record<UtilityResponsibility, string> = {
	tenant: "Kiracı",
	landlord: "Kiraya Veren",
	shared: "Ortak",
};

/** Friendly Turkish names for each tracked utility. */
export const UTILITY_NAMES = {
	electricity: "Elektrik",
	water: "Su",
	gas: "Doğalgaz",
	internet: "İnternet",
	aidat: "Aidat",
} as const;
