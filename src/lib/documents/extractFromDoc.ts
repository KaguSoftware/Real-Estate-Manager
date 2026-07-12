// Reads structured contract data back OUT of the editable document. Since
// the wizard's final stage has no form — the document IS the form — the
// tenant/lease/sale records are created from what the user typed into the
// structured cards (party cards, money boxes, key/value rows). Everything
// here reads node ATTRS (stable, card-input-edited), never free paragraph
// text, so extraction stays reliable. Pure + react-pdf/Tiptap-free.

import type { PartyInfo } from "@/src/lib/pdf/types";
import {
	BLOCK,
	type DocNode,
	type EditorDocJSON,
	type KVCardAttrs,
	type MoneyPairAttrs,
	type PartyCardAttrs,
} from "./blocks";

function* walk(node: DocNode): Generator<DocNode> {
	yield node;
	for (const child of node.content ?? []) yield* walk(child);
}

const lower = (s: string) => s.toLocaleLowerCase("tr");

/** "—" placeholders and blank strings become null. */
function textOrNull(v: string | null | undefined): string | null {
	const t = (v ?? "").trim();
	return t && t !== "—" ? t : null;
}

/** Turkish-formatted amount → number. Accepts "25.000", "25.000,50",
 *  "25000", "2,5", "1.234.567 TL". Returns null when unparseable. */
export function parseTrNumber(s: string | null | undefined): number | null {
	if (!s) return null;
	let t = s.replace(/[^\d.,-]/g, "");
	if (!t) return null;
	if (t.includes(",")) {
		// tr-TR: dots are thousands separators, comma is the decimal mark.
		t = t.replace(/\./g, "").replace(",", ".");
	} else if (t.includes(".")) {
		// Dots only: "25.000" is 25 000 (groups of 3), "2.5" is a decimal.
		const parts = t.split(".");
		if (parts.slice(1).every((p) => p.length === 3)) t = parts.join("");
	}
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

const TR_MONTHS: Record<string, number> = {
	ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4, mayıs: 5, mayis: 5,
	haziran: 6, temmuz: 7, ağustos: 8, agustos: 8, eylül: 9, eylul: 9,
	ekim: 10, kasım: 11, kasim: 11, aralık: 12, aralik: 12,
};

function isoOrNull(y: number, m: number, d: number): string | null {
	if (m < 1 || m > 12 || d < 1 || d > 31) return null;
	const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
	// Reject impossible dates like 31 Şubat (Date rolls them over).
	const check = new Date(`${iso}T00:00:00`);
	return check.getFullYear() === y && check.getMonth() === m - 1 && check.getDate() === d
		? iso
		: null;
}

/** Turkish date text → ISO yyyy-mm-dd. Accepts "12 Temmuz 2026",
 *  "12.07.2026", "12/07/2026" and "2026-07-12". Null when unparseable. */
export function parseTrDate(s: string | null | undefined): string | null {
	const t = textOrNull(s);
	if (!t) return null;
	const low = lower(t);
	let m = low.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (m) return isoOrNull(Number(m[1]), Number(m[2]), Number(m[3]));
	m = low.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
	if (m) return isoOrNull(Number(m[3]), Number(m[2]), Number(m[1]));
	m = low.match(/^(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})$/);
	if (m) {
		const month = TR_MONTHS[m[2]];
		if (!month) return null;
		return isoOrNull(Number(m[3]), month, Number(m[1]));
	}
	return null;
}

/** "1 Yıl" | "2 Yıl" | "Belirsiz süreli" (free text tolerant) → LeaseTerm
 *  ("undefined" is the DB's literal for indefinite-term leases). */
export function parseTermLabel(s: string | null | undefined): "1yr" | "2yr" | "undefined" | null {
	const t = textOrNull(s);
	if (!t) return null;
	const low = lower(t);
	if (low.includes("belirsiz")) return "undefined";
	const m = low.match(/(\d+)/);
	if (m?.[1] === "1") return "1yr";
	if (m?.[1] === "2") return "2yr";
	return null;
}

function partyCards(doc: EditorDocJSON): PartyCardAttrs[] {
	const out: PartyCardAttrs[] = [];
	for (const n of walk(doc)) {
		if (n.type === BLOCK.partyCard && n.attrs) out.push(n.attrs as unknown as PartyCardAttrs);
	}
	return out;
}

function partyByRole(cards: PartyCardAttrs[], roleContains: string): PartyInfo | null {
	const needle = lower(roleContains);
	for (const c of cards) {
		if (lower(c.role ?? "").includes(needle)) return c.party ?? null;
	}
	return null;
}

function moneyPairs(doc: EditorDocJSON): MoneyPairAttrs[] {
	const out: MoneyPairAttrs[] = [];
	for (const n of walk(doc)) {
		if (n.type === BLOCK.moneyPair && n.attrs) out.push(n.attrs as unknown as MoneyPairAttrs);
	}
	return out;
}

/** First money pair whose left label matches, falling back to the first
 *  pair in the document (the template always puts the main one first). */
function findMoneyPair(doc: EditorDocJSON, leftLabelContains: string): MoneyPairAttrs | null {
	const pairs = moneyPairs(doc);
	const needle = lower(leftLabelContains);
	return pairs.find((p) => lower(p.left?.label ?? "").includes(needle)) ?? pairs[0] ?? null;
}

/** Value of the first kvCard row whose label matches. */
function findKvValue(doc: EditorDocJSON, labelContains: string): string | null {
	const needle = lower(labelContains);
	for (const n of walk(doc)) {
		if (n.type !== BLOCK.kvCard || !n.attrs) continue;
		const items = (n.attrs as unknown as KVCardAttrs).items;
		if (!Array.isArray(items)) continue;
		for (const it of items) {
			if (it && typeof it.label === "string" && lower(it.label).includes(needle)) {
				return textOrNull(it.value);
			}
		}
	}
	return null;
}

export interface RentalDocExtract {
	landlord: PartyInfo | null;
	tenant: PartyInfo | null;
	guarantor: PartyInfo | null;
	monthlyRent: number | null;
	deposit: number | null;
	currency: string | null;
	term: "1yr" | "2yr" | "undefined" | null;
	/** Parsed ISO date; null when missing OR unreadable (see startDateRaw). */
	startDate: string | null;
	/** Raw card text — set whenever the row exists, even if unparseable. */
	startDateRaw: string | null;
	paymentDay: number | null;
	paymentMethod: string | null;
	bankAccount: string | null;
}

export function extractRentalFromDoc(doc: EditorDocJSON): RentalDocExtract {
	const cards = partyCards(doc);
	// Roles are user-editable text — match by default labels, fall back to
	// template position (landlord first, tenant second).
	const landlord = partyByRole(cards, "kiraya veren") ?? cards[0]?.party ?? null;
	const tenant = partyByRole(cards, "kiracı") ?? cards[1]?.party ?? null;
	const guarantor = partyByRole(cards, "kefil");

	const pair = findMoneyPair(doc, "kira");
	const startDateRaw = findKvValue(doc, "başlangıç");
	const paymentDayRaw = findKvValue(doc, "ödeme günü");
	const paymentDay = paymentDayRaw?.match(/(\d{1,2})/)?.[1];

	return {
		landlord,
		tenant,
		guarantor,
		monthlyRent: parseTrNumber(pair?.left?.value),
		deposit: parseTrNumber(pair?.right?.value),
		currency: textOrNull(pair?.left?.currency ?? null),
		term: parseTermLabel(findKvValue(doc, "süre")),
		startDate: parseTrDate(startDateRaw),
		startDateRaw,
		paymentDay: paymentDay ? Math.min(31, Math.max(1, Number(paymentDay))) : null,
		paymentMethod: findKvValue(doc, "ödeme şekli"),
		// NOT "iban": tr case-folding turns the label's "IBAN" into "ıban"
		// (dotless ı), which "iban" would never match.
		bankAccount: findKvValue(doc, "hesap"),
	};
}

export interface SalesDocExtract {
	seller: PartyInfo | null;
	buyer: PartyInfo | null;
	salePrice: number | null;
	depositAmount: number | null; // kapora; null when "—"
	currency: string | null;
}

export function extractSalesFromDoc(doc: EditorDocJSON): SalesDocExtract {
	const cards = partyCards(doc);
	const seller =
		partyByRole(cards, "mal sahibi") ?? partyByRole(cards, "satıcı") ?? cards[0]?.party ?? null;
	const buyer = partyByRole(cards, "alıcı") ?? cards[1]?.party ?? null;

	const pair = findMoneyPair(doc, "satış");

	return {
		seller,
		buyer,
		salePrice: parseTrNumber(pair?.left?.value),
		depositAmount: parseTrNumber(pair?.right?.value),
		currency: textOrNull(pair?.left?.currency ?? null),
	};
}
