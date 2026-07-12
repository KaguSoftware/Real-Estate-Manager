"use client";

/**
 * Tiptap schema for the contract editor. Standard rich text comes from
 * StarterKit (italic disabled — no italic PDF face exists, see
 * src/lib/pdf/styles.ts) plus tables and images; the structured contract
 * blocks are custom nodes whose JSON attrs are typed in
 * src/lib/documents/blocks.ts and rendered by the React views in nodes.tsx.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
	SectionChipView,
	PartyCardView,
	KVCardView,
	MoneyPairView,
	SignatureBlockView,
	CalloutView,
} from "./nodes";

/** Attribute helper: plain JSON attr with a default, no HTML parsing needed
 *  (documents persist as JSON; HTML round-tripping only matters for paste). */
const jsonAttr = (def: unknown) => ({ default: def });

export const SectionChip = Node.create({
	name: "sectionChip",
	group: "block",
	atom: true,
	draggable: true,
	addAttributes: () => ({ letter: jsonAttr(null), title: jsonAttr("") }),
	parseHTML: () => [{ tag: "div[data-node='sectionChip']" }],
	renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-node": "sectionChip" })],
	addNodeView() { return ReactNodeViewRenderer(SectionChipView); },
});

export const PartyCard = Node.create({
	name: "partyCard",
	group: "block",
	atom: true,
	draggable: true,
	addAttributes: () => ({ role: jsonAttr(""), party: jsonAttr({ full_name: "", address: "" }) }),
	parseHTML: () => [{ tag: "div[data-node='partyCard']" }],
	renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-node": "partyCard" })],
	addNodeView() { return ReactNodeViewRenderer(PartyCardView); },
});

export const KVCard = Node.create({
	name: "kvCard",
	group: "block",
	atom: true,
	draggable: true,
	addAttributes: () => ({ title: jsonAttr(null), items: jsonAttr([]) }),
	parseHTML: () => [{ tag: "div[data-node='kvCard']" }],
	renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-node": "kvCard" })],
	addNodeView() { return ReactNodeViewRenderer(KVCardView); },
});

export const MoneyPair = Node.create({
	name: "moneyPair",
	group: "block",
	atom: true,
	draggable: true,
	addAttributes: () => ({
		left: jsonAttr({ label: "", value: "", currency: "TRY" }),
		right: jsonAttr({ label: "", value: "", currency: "TRY" }),
	}),
	parseHTML: () => [{ tag: "div[data-node='moneyPair']" }],
	renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-node": "moneyPair" })],
	addNodeView() { return ReactNodeViewRenderer(MoneyPairView); },
});

export const SignatureBlock = Node.create({
	name: "signatureBlock",
	group: "block",
	atom: true,
	draggable: true,
	addAttributes: () => ({ date: jsonAttr(null), signers: jsonAttr([]) }),
	parseHTML: () => [{ tag: "div[data-node='signatureBlock']" }],
	renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-node": "signatureBlock" })],
	addNodeView() { return ReactNodeViewRenderer(SignatureBlockView); },
});

export const Callout = Node.create({
	name: "callout",
	group: "block",
	content: "inline*",
	draggable: true,
	addAttributes: () => ({ tone: jsonAttr("note") }),
	parseHTML: () => [{ tag: "div[data-node='callout']" }],
	renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-node": "callout" }), 0],
	addNodeView() { return ReactNodeViewRenderer(CalloutView); },
});

/** Numbered legal clause. Enter splits into a new clause; numbering is pure
 *  CSS (counter) in the editor and index-based in the PDF mapper. */
export const Clause = Node.create({
	name: "clause",
	content: "inline*",
	defining: true,
	parseHTML: () => [{ tag: "div[data-node='clause']" }],
	renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-node": "clause", class: "doc-clause" }), 0],
});

export const ClauseList = Node.create({
	name: "clauseList",
	group: "block",
	content: "clause+",
	draggable: true,
	parseHTML: () => [{ tag: "div[data-node='clauseList']" }],
	renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-node": "clauseList", class: "doc-clause-list" }), 0],
});

export const PageBreak = Node.create({
	name: "pageBreak",
	group: "block",
	atom: true,
	draggable: true,
	selectable: true,
	parseHTML: () => [{ tag: "div[data-node='pageBreak']" }],
	renderHTML: ({ HTMLAttributes }) =>
		["div", mergeAttributes(HTMLAttributes, { "data-node": "pageBreak", class: "doc-page-break" })],
});

/** Image with natural-dimension attrs so the PDF can size without measuring.
 *  src is always a compressed JPEG/PNG data URI (see Toolbar's upload flow). */
export const DocImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			width: jsonAttr(null),
			height: jsonAttr(null),
		};
	},
});

export function buildExtensions() {
	return [
		StarterKit.configure({
			heading: { levels: [2, 3] },
			// Not representable in the PDF — keep the editor WYSIWYG-honest.
			italic: false,          // no italic face registered (styles.ts)
			blockquote: false,
			code: false,
			codeBlock: false,
			horizontalRule: false,
			link: false,
		}),
		TableKit.configure({
			table: { resizable: false },
		}),
		DocImage,
		SectionChip,
		PartyCard,
		KVCard,
		MoneyPair,
		SignatureBlock,
		Callout,
		Clause,
		ClauseList,
		PageBreak,
		Placeholder.configure({
			placeholder: "Yazmaya başlayın veya araç çubuğundan blok ekleyin…",
		}),
	];
}
