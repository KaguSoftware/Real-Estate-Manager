// Builds the initial editable document (Tiptap JSON) from wizard data.
// Mirrors the section order of the classic PDF templates so the editable
// document starts out looking exactly like the locked one used to.
// Clause templates are interpolated here — the editor is WYSIWYG: users see
// and edit the real values, not {tokens}. React-pdf-free.

import { interpolate } from "@/src/lib/pdf/interpolate";
import type { RentalPDFData, SalesPDFData } from "@/src/lib/pdf/types";
import { UTILITY_RESP_LABELS, UTILITY_NAMES } from "@/src/lib/pdf/rentalClauses";
import {
	BLOCK,
	type DocNode,
	type EditorDocJSON,
	sectionChip,
	partyCard,
	kvCard,
	moneyPair,
	clauseList,
	signatureBlock,
	callout,
	paragraph,
	simpleTable,
	type KVItem,
} from "./blocks";
import { resolveClauseTemplates } from "./clauses";
import { buildRentalClauseVars, buildSalesClauseVars } from "./clauseVars";
import { docDate, docMoney } from "./format";

const orBlank = (s: string | number | null | undefined) =>
	s != null && String(s).trim() ? String(s) : "—";

const termLabel = (t: RentalPDFData["lease"]["term"]) =>
	t === "1yr" ? "1 Yıl" : t === "2yr" ? "2 Yıl" : "Belirsiz süreli";

/** True when the deposit exceeds the TBK m.342 cap of three months' rent. */
const depositOverCap = (deposit: number, monthlyRent: number) =>
	monthlyRent > 0 && deposit > monthlyRent * 3;

const UTILITY_KEYS = ["electricity", "water", "gas", "internet", "aidat"] as const;

export function buildRentalInitialDoc(data: RentalPDFData): EditorDocJSON {
	const { landlord, tenant, guarantor, property, lease, utilities, inventory, generatedAt } = data;

	const vars = buildRentalClauseVars(data);
	const clauses = resolveClauseTemplates("rental", data.clauses).map((c) => interpolate(c, vars));

	const propertyItems: KVItem[] = [
		{ label: "Niteliği", value: orBlank(property.nitelik) },
		{ label: "Yüz Ölçümü", value: property.size_sqm != null ? `${property.size_sqm} m²` : "—" },
		{ label: "Kat", value: orBlank(property.floor) },
		{ label: "Daire No", value: orBlank(property.unit_no) },
		{ label: "Şehir", value: orBlank(property.city) },
	];

	const leaseItems: KVItem[] = [
		{ label: "Süre", value: termLabel(lease.term) },
		{ label: "Başlangıç", value: docDate(lease.start_date) },
		{ label: "Bitiş", value: lease.end_date ? docDate(lease.end_date) : "Belirsiz süreli" },
		{ label: "Ödeme Günü", value: lease.payment_day != null ? `Her ayın ${lease.payment_day}. günü` : "—" },
		{ label: "Ödeme Şekli", value: orBlank(lease.payment_method) },
		{ label: "IBAN / Hesap", value: orBlank(lease.bank_account) },
	];

	const content: DocNode[] = [
		sectionChip("A", "Kiraya Veren Bilgileri"),
		partyCard("Kiraya Veren", landlord),
		sectionChip("B", "Kiracı Bilgileri"),
		partyCard("Kiracı", tenant),
	];
	if (guarantor) {
		content.push(sectionChip("C", "Kefil Bilgileri"), partyCard("Kefil", guarantor));
	}
	content.push(
		sectionChip(guarantor ? "D" : "C", "Taşınmaza Ait Bilgiler"),
		kvCard(property.address || "—", propertyItems),
		sectionChip(guarantor ? "E" : "D", "Kira ve Süre"),
		moneyPair(
			{ label: "Aylık Kira", value: docMoney(lease.monthly_rent), currency: lease.currency },
			{ label: "Depozito", value: docMoney(lease.deposit), currency: lease.currency },
		),
	);
	if (depositOverCap(lease.deposit, lease.monthly_rent)) {
		content.push(callout(
			"warning",
			"Uyarı: Depozito üç aylık kira bedelini aşmaktadır (TBK m.342 — yasal üst sınır aşılmış olabilir).",
		));
	}
	content.push(
		kvCard(null, leaseItems),
		sectionChip(guarantor ? "F" : "E", "Abonelik Sorumlulukları"),
		simpleTable(
			["Abonelik", "Sorumlu"],
			UTILITY_KEYS.map((k) => [UTILITY_NAMES[k], UTILITY_RESP_LABELS[utilities[k]]]),
		),
	);
	if (inventory.length > 0) {
		content.push(
			sectionChip(null, "Demirbaş Listesi"),
			simpleTable(
				["Demirbaş", "Adet", "Not"],
				inventory.map((it) => [orBlank(it.item), it.qty == null ? "—" : String(it.qty), orBlank(it.note)]),
			),
		);
	}
	if (data.condition_notes?.trim()) {
		content.push(sectionChip(null, "Taşınmazın Durumu"), paragraph(data.condition_notes.trim()));
	}
	if (data.special_conditions?.trim()) {
		content.push(sectionChip(null, "Özel Şartlar"), paragraph(data.special_conditions.trim()));
	}
	content.push(
		sectionChip(null, "İlgili Hükümler"),
		clauseList(clauses),
		signatureBlock(
			[
				{ role: "Kiraya Veren", name: landlord.full_name },
				{ role: "Kiracı", name: tenant.full_name },
				...(guarantor ? [{ role: "Kefil", name: guarantor.full_name }] : []),
			],
			docDate(generatedAt),
		),
	);

	return { type: BLOCK.doc, content };
}

export function buildSalesInitialDoc(data: SalesPDFData, teamName: string): EditorDocJSON {
	const { seller, buyer, property, sale, commission, generatedAt } = data;

	const vars = buildSalesClauseVars(data, teamName);
	const clauses = resolveClauseTemplates("sales", data.clauses).map((c) => interpolate(c, vars));

	const propertyItems: KVItem[] = [
		{ label: "Niteliği", value: orBlank(property.nitelik) },
		{ label: "Yüz Ölçümü", value: property.yuz_olcumu ? `${property.yuz_olcumu} m²` : "—" },
		{ label: "Durum", value: orBlank(property.durum) },
		{ label: "Mahalle", value: orBlank(property.mahalle) },
		{ label: "Mevkii", value: orBlank(property.mevkii) },
		{ label: "Ada No", value: orBlank(property.ada_no) },
		{ label: "Parsel No", value: orBlank(property.parsel_no) },
	];

	const commissionRow = (label: string, line: SalesPDFData["commission"]["buyer"]) => [
		label,
		line.rate == null ? "—" : `%${line.rate.toFixed(2)}`,
		line.matrah == null ? "—" : docMoney(line.matrah),
		line.kdv == null ? "—" : docMoney(line.kdv),
		line.total == null ? "—" : docMoney(line.total),
	];

	const content: DocNode[] = [
		sectionChip("A", "Mal Sahibi Bilgileri"),
		partyCard("Mal Sahibi", seller),
		sectionChip("B", "Alıcı Bilgileri"),
		partyCard("Alıcı", buyer),
		sectionChip("C", "Gayrimenkule Ait Bilgiler"),
		kvCard(property.address || "—", propertyItems),
	];
	if (data.special_conditions?.trim()) {
		content.push(sectionChip("D", "Özel Şartlar"), paragraph(data.special_conditions.trim()));
	}
	content.push(
		sectionChip(data.special_conditions?.trim() ? "E" : "D", "Yapılacak İşleme Ait Bilgiler"),
		simpleTable(
			["Hizmet Bedeli", "Oran", "Matrah", "KDV", "Toplam"],
			[commissionRow("Alıcı", commission.buyer), commissionRow("Satıcı", commission.seller)],
		),
		moneyPair(
			{ label: "Satış Bedeli", value: docMoney(sale.sale_price), currency: sale.currency },
			{
				label: "Kapora",
				value: sale.deposit_amount != null ? docMoney(sale.deposit_amount) : "—",
				currency: sale.currency,
			},
		),
		paragraph(`Bundan böyle, ${teamName.toLocaleUpperCase("tr")} yetkilendiren MAL SAHİBİ olarak anılacaktır.`),
		sectionChip(null, "İlgili Hükümler"),
		clauseList(clauses),
		signatureBlock(
			[
				{ role: "Mal Sahibi", name: seller.full_name },
				{ role: "Alıcı", name: buyer.full_name },
				{ role: teamName },
			],
			docDate(generatedAt),
		),
	);

	return { type: BLOCK.doc, content };
}

export function buildInitialDoc(
	kind: "rental" | "sales",
	data: RentalPDFData | SalesPDFData,
	teamName: string,
): EditorDocJSON {
	return kind === "rental"
		? buildRentalInitialDoc(data as RentalPDFData)
		: buildSalesInitialDoc(data as SalesPDFData, teamName);
}
