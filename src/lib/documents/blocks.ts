// The document block model: node-type names and attribute shapes shared by
// the Tiptap editor (src/components/documents/editor) and the react-pdf
// mapper (src/lib/pdf/editorDoc.tsx). This module is deliberately free of
// both Tiptap and react-pdf imports — it defines the JSON contract only.
//
// The JSON matches Tiptap's document format: nested nodes with `type`,
// optional `attrs`, `content` (child nodes) and, on text nodes, `text` +
// `marks`. Anything the mapper does not recognize degrades to plain text
// (never a crash) — see editorDoc.tsx.

import type { PartyInfo } from "@/src/lib/pdf/types";

// ── Node type names ──────────────────────────────────────────────────────────
export const BLOCK = {
	doc: "doc",
	paragraph: "paragraph",
	heading: "heading",
	text: "text",
	hardBreak: "hardBreak",
	bulletList: "bulletList",
	orderedList: "orderedList",
	listItem: "listItem",
	table: "table",
	tableRow: "tableRow",
	tableHeader: "tableHeader",
	tableCell: "tableCell",
	image: "image",
	// custom nodes
	sectionChip: "sectionChip",
	partyCard: "partyCard",
	kvCard: "kvCard",
	moneyPair: "moneyPair",
	clauseList: "clauseList",
	clause: "clause",
	signatureBlock: "signatureBlock",
	callout: "callout",
	pageBreak: "pageBreak",
} as const;

export type MarkName = "bold" | "italic" | "underline";

// ── JSON node shape (Tiptap-compatible) ─────────────────────────────────────
export interface DocMark {
	type: string;
	attrs?: Record<string, unknown>;
}

export interface DocNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: DocNode[];
	text?: string;
	marks?: DocMark[];
}

/** A whole editor document. */
export interface EditorDocJSON extends DocNode {
	type: typeof BLOCK.doc;
	content: DocNode[];
}

// ── Custom node attribute shapes ─────────────────────────────────────────────
export interface SectionChipAttrs {
	letter: string | null;
	title: string;
}

export interface PartyCardAttrs {
	role: string;      // e.g. "Kiraya Veren"
	party: PartyInfo;
}

export interface KVItem {
	label: string;
	value: string;
}

export interface KVCardAttrs {
	title: string | null;   // e.g. the property address
	items: KVItem[];
}

export interface MoneyCell {
	label: string;
	value: string;     // pre-formatted, e.g. "25.000"
	currency: string;  // e.g. "TRY"
}

export interface MoneyPairAttrs {
	left: MoneyCell;
	right: MoneyCell;
}

export interface SignatureBlockAttrs {
	date: string | null;                       // pre-formatted signing date
	signers: { role: string; name?: string }[];
}

export interface CalloutAttrs {
	tone: "note" | "warning";
}

export interface ImageAttrs {
	src: string;              // data URI (PNG/JPEG)
	width?: number | null;    // natural px, stored at insert time
	height?: number | null;
	alt?: string | null;
}

// ── Constructors (used by buildInitialDoc and tests) ─────────────────────────
export const text = (t: string, marks?: DocMark[]): DocNode =>
	marks && marks.length ? { type: BLOCK.text, text: t, marks } : { type: BLOCK.text, text: t };

export const paragraph = (t?: string): DocNode =>
	t && t.length ? { type: BLOCK.paragraph, content: [text(t)] } : { type: BLOCK.paragraph };

export const sectionChip = (letter: string | null, title: string): DocNode => ({
	type: BLOCK.sectionChip,
	attrs: { letter, title } satisfies SectionChipAttrs,
});

export const partyCard = (role: string, party: PartyInfo): DocNode => ({
	type: BLOCK.partyCard,
	attrs: { role, party } satisfies PartyCardAttrs,
});

export const kvCard = (title: string | null, items: KVItem[]): DocNode => ({
	type: BLOCK.kvCard,
	attrs: { title, items } satisfies KVCardAttrs,
});

export const moneyPair = (left: MoneyCell, right: MoneyCell): DocNode => ({
	type: BLOCK.moneyPair,
	attrs: { left, right } satisfies MoneyPairAttrs,
});

export const clause = (t: string): DocNode => ({
	type: BLOCK.clause,
	content: t.length ? [text(t)] : [],
});

export const clauseList = (clauses: string[]): DocNode => ({
	type: BLOCK.clauseList,
	content: clauses.map(clause),
});

export const signatureBlock = (
	signers: { role: string; name?: string }[],
	date: string | null,
): DocNode => ({
	type: BLOCK.signatureBlock,
	attrs: { date, signers } satisfies SignatureBlockAttrs,
});

export const callout = (tone: CalloutAttrs["tone"], t: string): DocNode => ({
	type: BLOCK.callout,
	attrs: { tone } satisfies CalloutAttrs,
	content: [text(t)],
});

/** Simple table from string cells; first row becomes the header row. */
export const simpleTable = (header: string[], rows: string[][]): DocNode => ({
	type: BLOCK.table,
	content: [
		{
			type: BLOCK.tableRow,
			content: header.map((h) => ({ type: BLOCK.tableHeader, content: [paragraph(h)] })),
		},
		...rows.map((cells) => ({
			type: BLOCK.tableRow,
			content: cells.map((c) => ({ type: BLOCK.tableCell, content: [paragraph(c)] })),
		})),
	],
});

/** Extract the concatenated plain text of a node subtree (fallback rendering). */
export function plainText(node: DocNode): string {
	if (node.type === BLOCK.text) return node.text ?? "";
	if (node.type === BLOCK.hardBreak) return "\n";
	return (node.content ?? []).map(plainText).join("");
}
