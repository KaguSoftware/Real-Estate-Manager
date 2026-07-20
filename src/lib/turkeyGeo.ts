// Turkey's 81 provinces (il), in plate-code order.
//
// Bundled offline rather than fetched: the list is small, effectively static
// (unchanged since Düzce became the 81st in 1999), and agents work in the field
// on poor connections. Districts (~970) and neighbourhoods (~50k) are
// deliberately NOT included — they're volatile and too large to justify in the
// client bundle, so those fields stay free-text.
//
// Used as *suggestions*, never a whitelist: existing rows already hold
// arbitrary city strings, and villages/site names are legitimate values.

export const TURKEY_PROVINCES: string[] = [
	"Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya",
	"Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu",
	"Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır",
	"Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep",
	"Giresun", "Gümüşhane", "Hakkâri", "Hatay", "Isparta", "Mersin", "İstanbul",
	"İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli",
	"Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla",
	"Muş", "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt",
	"Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa",
	"Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman",
	"Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova",
	"Karabük", "Kilis", "Osmaniye", "Düzce",
];

/**
 * Fold a Turkish string for accent- and case-insensitive matching, so typing
 * "istanbul" or "IZMIR" finds "İstanbul" / "İzmir".
 *
 * Turkish casing is dotted-i sensitive: "İ".toLowerCase() is "i̇" (i + combining
 * dot) in most locales, which never equals a typed "i". Mapping the accented
 * characters explicitly before lowercasing sidesteps that entirely.
 */
export function foldTr(input: string): string {
	return input
		.replace(/[İI]/g, "i")
		.replace(/[ıI]/g, "i")
		.replace(/Ğ/g, "ğ").replace(/Ü/g, "ü").replace(/Ş/g, "ş")
		.replace(/Ö/g, "ö").replace(/Ç/g, "ç")
		.toLocaleLowerCase("tr-TR")
		.replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
		.replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a")
		.trim();
}
