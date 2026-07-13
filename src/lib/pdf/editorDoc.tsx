// Editor document → react-pdf mapper. Walks the Tiptap JSON produced by the
// contract editor (contract shape defined in src/lib/documents/blocks.ts —
// this module never imports Tiptap) and renders it through the same design
// primitives the static templates use, so editor output and classic output
// stay one design system.
//
// Resilience contract: NEVER throw mid-render. An unknown node type degrades
// to its plain-text content; a malformed known node is skipped with a faint
// placeholder so the surrounding document still renders and exports.

import { View, Text, Image } from "@react-pdf/renderer";
import { styles, colors } from "./styles";
import { useBranding } from "./branding";
import {
	SectionChip,
	PartyCard,
	KVCard,
	MoneyPair,
	Callout,
	SignatureBlock,
	SectionTitle,
} from "./sections/common";
import {
	BLOCK,
	plainText,
	type DocNode,
	type EditorDocJSON,
	type SectionChipAttrs,
	type PartyCardAttrs,
	type KVCardAttrs,
	type MoneyPairAttrs,
	type SignatureBlockAttrs,
	type CalloutAttrs,
	type ImageAttrs,
} from "@/src/lib/documents/blocks";

// A4 content column: 595pt page − 2×48pt padding.
const CONTENT_WIDTH = 499;

const warnDev = (msg: string, node: DocNode) => {
	if (process.env.NODE_ENV !== "production") {
		console.warn(`[pdf/editorDoc] ${msg}`, node.type, node.attrs);
	}
};

/** Inline text runs with bold/underline marks. Italic renders as regular —
 *  no italic face is registered (see the note in styles.ts). */
function InlineRuns({ nodes }: { nodes: DocNode[] }) {
	return (
		<>
			{nodes.map((n, i) => {
				if (n.type === BLOCK.hardBreak) return <Text key={i}>{"\n"}</Text>;
				if (n.type === BLOCK.text) {
					let bold = false;
					let underline = false;
					for (const m of n.marks ?? []) {
						if (m.type === "bold") bold = true;
						if (m.type === "underline") underline = true;
					}
					if (!bold && !underline) return <Text key={i}>{n.text ?? ""}</Text>;
					return (
						<Text
							key={i}
							style={{
								...(bold ? { fontWeight: 700 } : {}),
								...(underline ? { textDecoration: "underline" } : {}),
							}}
						>
							{n.text ?? ""}
						</Text>
					);
				}
				return <Text key={i}>{plainText(n)}</Text>;
			})}
		</>
	);
}

/** The inline runs of a block container (paragraph children of a cell, etc.),
 *  flattened with newlines between paragraphs. */
function BlockInline({ blocks }: { blocks: DocNode[] }) {
	return (
		<>
			{blocks.map((b, i) => (
				<Text key={i}>
					{i > 0 ? "\n" : null}
					<InlineRuns nodes={b.content ?? []} />
				</Text>
			))}
		</>
	);
}

function ListBlock({ node, ordered }: { node: DocNode; ordered: boolean }) {
	const items = node.content ?? [];
	return (
		<View style={{ marginBottom: 10 }}>
			{items.map((li, i) => (
				<View key={i} style={{ flexDirection: "row", marginBottom: 3 }} wrap={false}>
					<Text style={[styles.bodyText, { width: 18, fontWeight: 700 }]}>
						{ordered ? `${i + 1}.` : "•"}
					</Text>
					<View style={{ flex: 1 }}>
						{(li.content ?? []).map((child, j) => (
							<BlockNode key={j} node={child} />
						))}
					</View>
				</View>
			))}
		</View>
	);
}

function TableBlock({ node }: { node: DocNode }) {
	const { palette } = useBranding();
	const rows = (node.content ?? []).filter((r) => r.type === BLOCK.tableRow);
	if (rows.length === 0) return null;
	// Precompute header/zebra metadata (no mutation inside the JSX map).
	const meta: { row: DocNode; cells: DocNode[]; isHeader: boolean; zebra: boolean }[] = [];
	let bodyIndex = 0;
	for (const row of rows) {
		const cells = row.content ?? [];
		const isHeader = cells.length > 0 && cells.every((c) => c.type === BLOCK.tableHeader);
		if (!isHeader) bodyIndex += 1;
		meta.push({ row, cells, isHeader, zebra: !isHeader && bodyIndex % 2 === 0 });
	}
	return (
		<View style={[styles.table, { marginBottom: 12 }]}>
			{meta.map(({ cells, isHeader, zebra }, r) => {
				return (
					<View
						key={r}
						style={[
							isHeader
								? { flexDirection: "row", backgroundColor: palette.primary }
								: styles.tableRow,
							r === 0 ? { borderTopWidth: 0 } : {},
							zebra ? { backgroundColor: palette.tint } : {},
						]}
						wrap={false}
					>
						{cells.map((cell, c) => {
							const span = Number((cell.attrs as { colspan?: number } | undefined)?.colspan ?? 1) || 1;
							return (
								<View key={c} style={{ flex: span, paddingVertical: 6, paddingHorizontal: 8 }}>
									<Text
										style={
											isHeader
												? {
														fontSize: 7,
														fontWeight: 700,
														color: colors.white,
														textTransform: "uppercase",
														letterSpacing: 0.5,
													}
												: { fontSize: 8.5, color: colors.slate800 }
										}
									>
										<BlockInline blocks={cell.content ?? []} />
									</Text>
								</View>
							);
						})}
					</View>
				);
			})}
		</View>
	);
}

function ImageBlock({ node }: { node: DocNode }) {
	const attrs = (node.attrs ?? {}) as Partial<ImageAttrs>;
	if (!attrs.src || typeof attrs.src !== "string") {
		warnDev("image without src skipped", node);
		return null;
	}
	// Stored natural px dims (captured at insert time) let us size without
	// react-pdf having to measure; CSS px → pt is ×0.75.
	let width = CONTENT_WIDTH;
	let height: number | undefined;
	if (attrs.width && attrs.height && attrs.width > 0 && attrs.height > 0) {
		width = Math.min(attrs.width * 0.75, CONTENT_WIDTH);
		height = (attrs.height / attrs.width) * width;
	}
	return (
		<View style={{ marginBottom: 12 }} wrap={false}>
			{/* eslint-disable-next-line jsx-a11y/alt-text */}
			<Image
				src={attrs.src}
				style={height
					? { width, height, borderRadius: 3, objectFit: "contain" }
					: { width, maxHeight: 280, borderRadius: 3, objectFit: "contain" }}
			/>
		</View>
	);
}

function RichClausesList({ node }: { node: DocNode }) {
	const { palette } = useBranding();
	const clauses = (node.content ?? []).filter((c) => c.type === BLOCK.clause);
	if (clauses.length === 0) return null;
	return (
		<View style={styles.section}>
			{clauses.map((c, idx) => (
				<View
					key={idx}
					style={idx === clauses.length - 1 ? styles.clauseRowLast : styles.clauseRow}
					wrap={false}
				>
					<Text style={[styles.clauseNumber, { color: palette.accent }]}>
						{String(idx + 1).padStart(2, "0")}
					</Text>
					<Text style={styles.clauseText}>
						<InlineRuns nodes={c.content ?? []} />
					</Text>
				</View>
			))}
		</View>
	);
}

const HEADING_STYLES: Record<number, { fontSize: number }> = {
	1: { fontSize: 15 },
	2: { fontSize: 13 },
	3: { fontSize: 11 },
};

// plainText() walks node content directly (not JSX) and is the one call in this
// module that can actually throw on malformed data — isolate that risk here so
// the switch below never needs a try/catch around JSX construction (JSX itself
// never throws synchronously; React defers rendering, so a try/catch around it
// can't catch child-render errors anyway — use an error boundary for that).
function safePlainText(node: DocNode): string {
	try {
		return plainText(node);
	} catch {
		warnDev("plainText failed", node);
		return "";
	}
}

function BlockNode({ node }: { node: DocNode }) {
	const { palette } = useBranding();
	switch (node.type) {
		case BLOCK.paragraph: {
			if (!node.content?.length) return <View style={{ height: 8 }} />;
			return (
				<Text style={[styles.bodyText, { marginBottom: 8 }]}>
					<InlineRuns nodes={node.content} />
				</Text>
			);
		}
		case BLOCK.heading: {
			const level = Number((node.attrs as { level?: number } | undefined)?.level ?? 2);
			const size = HEADING_STYLES[level] ?? HEADING_STYLES[2];
			return (
				<View minPresenceAhead={40} style={{ marginBottom: 8, marginTop: 4 }}>
					<Text style={{ fontSize: size.fontSize, fontWeight: 700, color: palette.primary }}>
						<InlineRuns nodes={node.content ?? []} />
					</Text>
				</View>
			);
		}
		case BLOCK.bulletList:
			return <ListBlock node={node} ordered={false} />;
		case BLOCK.orderedList:
			return <ListBlock node={node} ordered={true} />;
		case BLOCK.table:
			return <TableBlock node={node} />;
		case BLOCK.image:
			return <ImageBlock node={node} />;
		case BLOCK.sectionChip: {
			const a = node.attrs as SectionChipAttrs | undefined;
			if (!a?.title) { warnDev("sectionChip without title skipped", node); return null; }
			return <SectionChip letter={a.letter ?? undefined} title={a.title} />;
		}
		case BLOCK.partyCard: {
			const a = node.attrs as PartyCardAttrs | undefined;
			if (!a?.party) { warnDev("partyCard without party skipped", node); return <FaultyBlock />; }
			return (
				<View style={{ marginBottom: 12 }}>
					<PartyCard party={a.party} roleLabel={a.role || "Taraf"} />
				</View>
			);
		}
		case BLOCK.kvCard: {
			const a = node.attrs as KVCardAttrs | undefined;
			if (!Array.isArray(a?.items)) { warnDev("kvCard without items skipped", node); return <FaultyBlock />; }
			return (
				<View style={{ marginBottom: 12 }}>
					<KVCard title={a.title} items={a.items} />
				</View>
			);
		}
		case BLOCK.moneyPair: {
			const a = node.attrs as MoneyPairAttrs | undefined;
			if (!a?.left || !a?.right) { warnDev("moneyPair missing sides skipped", node); return <FaultyBlock />; }
			return (
				<View style={{ marginBottom: 12 }}>
					<MoneyPair left={a.left} right={a.right} />
				</View>
			);
		}
		case BLOCK.clauseList:
			return <RichClausesList node={node} />;
		case BLOCK.signatureBlock: {
			const a = node.attrs as SignatureBlockAttrs | undefined;
			if (!Array.isArray(a?.signers) || a.signers.length === 0) {
				warnDev("signatureBlock without signers skipped", node);
				return <FaultyBlock />;
			}
			return <SignatureBlock label="İmzalar" signers={a.signers} date={a.date ?? undefined} />;
		}
		case BLOCK.callout: {
			const tone = ((node.attrs as CalloutAttrs | undefined)?.tone === "warning" ? "warning" : "note") as
				| "warning"
				| "note";
			return (
				<View style={{ marginBottom: 12 }}>
					<Callout tone={tone}>{safePlainText(node)}</Callout>
				</View>
			);
		}
		case BLOCK.pageBreak:
			return <View break />;
		default: {
			// Unknown node: degrade to its text content, never crash the render.
			warnDev("unknown node rendered as plain text", node);
			const t = safePlainText(node);
			return t ? <Text style={[styles.bodyText, { marginBottom: 8 }]}>{t}</Text> : null;
		}
	}
}

const FaultyBlock = () => (
	<Text style={{ fontSize: 8, color: colors.slate400, marginBottom: 8 }}>[Blok işlenemedi]</Text>
);

/**
 * The whole editable-document body, rendered inside a `<Page wrap>`.
 *
 * Returns a FRAGMENT, not a wrapping <View>: react-pdf honors the `break`
 * prop only on direct children of <Page> (verified against 4.3.3 — a break
 * nested inside any View is silently ignored and its subtree can even be
 * dropped). Keeping blocks as direct Page children makes the pageBreak node
 * work; wrap={false} and minPresenceAhead behave the same either way.
 */
export function EditorDocBody({ doc }: { doc: EditorDocJSON }) {
	const content = Array.isArray(doc?.content) ? doc.content : [];
	return (
		<>
			{content.map((node, i) => (
				<BlockNode key={i} node={node} />
			))}
		</>
	);
}

// Re-exported so document.tsx can render a fallback title when needed.
export { SectionTitle };
