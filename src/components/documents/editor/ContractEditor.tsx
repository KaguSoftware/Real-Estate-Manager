"use client";

/**
 * ContractEditor — the block-based document editor shown at the wizard's
 * final step and on the re-edit page. Renders an A4-proportioned sheet with
 * Notion-style drag handles, a sticky toolbar and approximate page-break
 * guides ("the PDF preview is the source of truth for exact pagination").
 *
 * This module (and everything under editor/) is loaded ONLY via
 * next/dynamic({ ssr: false }) — Tiptap must stay out of the SSR bundle and
 * out of every non-document route (same policy as PDFBlobProvider).
 */

import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { GripVertical } from "lucide-react";
import type { EditorDocJSON } from "@/src/lib/documents/blocks";
import type { BrandPalette } from "@/src/lib/pdf/branding";
import { cn } from "@/src/components/ui";
import { buildExtensions } from "./extensions";
import { Toolbar } from "./Toolbar";
import "./editor.css";

// A4 geometry mirrored from src/lib/pdf/styles.ts. The on-screen sheet is
// 794px wide (≈595pt at 96dpi); one page holds 722pt of content flow.
const SHEET_WIDTH_PX = 794;
const SHEET_PADDING_PX = 48;
const PAGE_CONTENT_PT = 842 - 48 - 72;
const CONTENT_WIDTH_PT = 499;

export interface ContractEditorHandle {
	/** Current document JSON (call on toggle-to-preview / save / confirm). */
	getJSON(): EditorDocJSON;
	/** Replace the whole document (used by "Şablona sıfırla"). */
	setContent(doc: EditorDocJSON): void;
}

export interface ContractEditorProps {
	initialDoc: EditorDocJSON;
	palette: BrandPalette;
	editable?: boolean;
	/** Debounced (800 ms) document changes — used for draft autosave. */
	onChangeJson?: (json: EditorDocJSON) => void;
	/** Fires synchronously on the first keystroke of a user edit (not on
	 *  programmatic setContent) — lets the wizard stop live-rebuilding the
	 *  document once the user has customized it. */
	onDirty?: () => void;
	/** initialDoc failed schema validation (corrupt/outdated draft). Without
	 *  this, Tiptap silently falls back to an EMPTY document — and the next
	 *  autosave would overwrite the stored draft with it. */
	onInvalidContent?: () => void;
	/** Shown in the toolbar when provided ("Şablona sıfırla"). */
	onReset?: () => void;
	/** Ref-object alternative to the forwarded ref — next/dynamic does not
	 *  forward refs, and this component is always loaded through it. */
	apiRef?: React.MutableRefObject<ContractEditorHandle | null>;
	className?: string;
}

export const ContractEditor = forwardRef<ContractEditorHandle, ContractEditorProps>(
	function ContractEditor(
		{ initialDoc, palette, editable = true, onChangeJson, onDirty, onInvalidContent, onReset, apiRef, className },
		ref,
	) {
		const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
		const onChangeRef = useRef(onChangeJson);
		const onDirtyRef = useRef(onDirty);
		const onInvalidRef = useRef(onInvalidContent);
		useEffect(() => {
			onChangeRef.current = onChangeJson;
			onDirtyRef.current = onDirty;
			onInvalidRef.current = onInvalidContent;
		}, [onChangeJson, onDirty, onInvalidContent]);

		const editor = useEditor({
			extensions: buildExtensions(),
			content: initialDoc,
			editable,
			immediatelyRender: false,
			enableContentCheck: true,
			onContentError() {
				// Defer: fires during editor creation, before parents have refs.
				setTimeout(() => onInvalidRef.current?.(), 0);
			},
			onUpdate({ editor: e }) {
				onDirtyRef.current?.();
				if (!onChangeRef.current) return;
				if (changeTimer.current) clearTimeout(changeTimer.current);
				changeTimer.current = setTimeout(() => {
					onChangeRef.current?.(e.getJSON() as EditorDocJSON);
				}, 800);
			},
		});

		// Flush (not just drop) a pending debounced change on unmount —
		// otherwise the last ~800 ms of typing never reaches the draft.
		useEffect(() => {
			if (!editor) return;
			return () => {
				if (!changeTimer.current) return;
				clearTimeout(changeTimer.current);
				changeTimer.current = null;
				if (!editor.isDestroyed) {
					onChangeRef.current?.(editor.getJSON() as EditorDocJSON);
				}
			};
		}, [editor]);

		useEffect(() => {
			// second arg false: setEditable also emits `update` by default.
			editor?.setEditable(editable, false);
		}, [editor, editable]);

		// Programmatic content swaps (rebuilds, template resets) must not emit
		// `update` — Tiptap v3 defaults emitUpdate to TRUE, which would make a
		// rebuild look like a user edit (dirty flag + autosave loop).
		useImperativeHandle(ref, () => ({
			getJSON: () => (editor?.getJSON() ?? initialDoc) as EditorDocJSON,
			setContent: (doc) => editor?.commands.setContent(doc, { emitUpdate: false }),
		}), [editor, initialDoc]);

		useEffect(() => {
			if (!apiRef) return;
			apiRef.current = {
				getJSON: () => (editor?.getJSON() ?? initialDoc) as EditorDocJSON,
				setContent: (doc) => editor?.commands.setContent(doc, { emitUpdate: false }),
			};
			return () => { apiRef.current = null; };
		}, [apiRef, editor, initialDoc]);

		// Wide viewports dock the toolbar beside the sheet (it follows the
		// scroll); narrow ones fall back to the sticky top bar.
		const [wide, setWide] = useState(false);
		useEffect(() => {
			const mq = window.matchMedia("(min-width: 1024px)");
			const update = () => setWide(mq.matches);
			update();
			mq.addEventListener("change", update);
			return () => mq.removeEventListener("change", update);
		}, []);

		// ── Approximate page guides ────────────────────────────────────────
		// Recomputed from the sheet's rendered height; labeled approximate —
		// react-pdf's layout engine is the source of truth (PDF önizleme).
		const sheetRef = useRef<HTMLDivElement>(null);
		const [guides, setGuides] = useState<number[]>([]);
		useEffect(() => {
			const el = sheetRef.current;
			if (!el) return;
			const compute = () => {
				const width = el.clientWidth;
				const scale = (width - SHEET_PADDING_PX * 2) / CONTENT_WIDTH_PT;
				const pagePx = PAGE_CONTENT_PT * scale;
				const contentHeight = el.scrollHeight - SHEET_PADDING_PX * 2;
				const pages = Math.floor(contentHeight / pagePx);
				const next = Array.from(
					{ length: Math.min(pages, 40) },
					(_, i) => Math.round(SHEET_PADDING_PX + (i + 1) * pagePx),
				);
				// Keep the previous array when nothing moved — avoids re-render churn
				// on every keystroke (ResizeObserver fires on content growth).
				setGuides((prev) =>
					prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next,
				);
			};
			compute();
			const ro = new ResizeObserver(compute);
			ro.observe(el);
			return () => ro.disconnect();
		}, [editor]);

		const paletteVars = useMemo(
			() => ({
				"--doc-primary": palette.primary,
				"--doc-accent": palette.accent,
				"--doc-tint": palette.tint,
			}) as React.CSSProperties,
			[palette],
		);

		if (!editor) {
			return (
				<div className={cn("py-16 text-center text-sm text-base-content/50", className)}>
					Düzenleyici yükleniyor…
				</div>
			);
		}

		return (
			<div className={cn("contract-editor", className)} style={paletteVars}>
				{editable && !wide && <Toolbar editor={editor} onReset={onReset} locked={!editable} />}

				<div className="flex items-start justify-center gap-3">
					{/* Docked side toolbar: sticky below the app header, follows scroll. */}
					{editable && wide && (
						<div className="sticky top-20 z-20 shrink-0">
							<Toolbar editor={editor} onReset={onReset} locked={!editable} orientation="vertical" />
						</div>
					)}

					<div className="flex-1 min-w-0 mt-4 pb-8 overflow-x-auto">
					<div
						ref={sheetRef}
						className="relative mx-auto bg-white text-neutral-900 rounded-sm shadow-[0_1px_3px_rgba(15,23,42,0.12),0_8px_28px_rgba(15,23,42,0.10)]"
						style={{ maxWidth: SHEET_WIDTH_PX, padding: SHEET_PADDING_PX }}
					>
						{/* Approximate page-break guides. Own stable container: the drag
						    handle mutates DOM inside the sheet, so React must never
						    reconcile a changing sibling list at the sheet level (that's
						    the "insertBefore … not a child" crash). */}
						<div className="absolute inset-0 pointer-events-none" aria-hidden>
							{guides.map((top, i) => (
								<div key={i} className="doc-page-guide" style={{ top }}>
									<span>≈ Sayfa {i + 1} sonu</span>
								</div>
							))}
						</div>

						<div contentEditable={false}>
							{editable ? (
								<DragHandle editor={editor} className="doc-drag-handle">
									<GripVertical className="w-4 h-4" />
								</DragHandle>
							) : null}
						</div>

						<EditorContent editor={editor} />
					</div>

						<p className="text-center text-xs text-base-content/40 mt-4 pb-2">
							Sayfa çizgileri yaklaşıktır — kesin sayfa düzeni için PDF önizlemeye bakın.
						</p>
					</div>
				</div>
			</div>
		);
	},
);
