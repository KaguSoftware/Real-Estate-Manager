"use client";

/**
 * Contract editor toolbar. Two orientations:
 *  - "vertical" (desktop): a slim floating panel docked beside the sheet that
 *    follows the scroll — every tool stays within reach while editing.
 *  - "horizontal" (narrow viewports): the sticky top bar.
 * Desktop reorders blocks by drag handle; on coarse pointers the toolbar
 * exposes move/delete buttons instead (drag is unreliable on touch).
 */

import { useId, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
	ArrowDown,
	ArrowUp,
	BetweenHorizontalStart,
	BetweenVerticalStart,
	Bold,
	Grid2x2X,
	ImagePlus,
	Info,
	List,
	ListOrdered,
	PenLine,
	Plus,
	Redo2,
	RotateCcw,
	Scissors,
	Table as TableIcon,
	TableColumnsSplit,
	TableRowsSplit,
	Tag,
	Trash2,
	Underline,
	Undo2,
	LayoutList,
	Rows3,
} from "lucide-react";
import { cn, toast } from "@/src/components/ui";

// react-pdf renders PNG/JPEG only — reject anything else at the door.
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"];
const MAX_IMAGES = 8;
const MAX_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024; // data-URI chars ≈ bytes × 4/3

function countImages(json: unknown): { count: number; bytes: number } {
	let count = 0;
	let bytes = 0;
	const walk = (n: unknown) => {
		if (!n || typeof n !== "object") return;
		const node = n as { type?: string; attrs?: { src?: string }; content?: unknown[] };
		if (node.type === "image") {
			count += 1;
			bytes += Math.floor((node.attrs?.src?.length ?? 0) * 0.75);
		}
		node.content?.forEach(walk);
	};
	walk(json);
	return { count, bytes };
}

/** Move or delete the top-level block containing the selection. */
function topLevelBlockRange(editor: Editor): { index: number; from: number; to: number } | null {
	const { state } = editor;
	const { $from } = state.selection;
	const index = $from.index(0);
	if (index < 0 || index >= state.doc.childCount) return null;
	let from = 0;
	state.doc.forEach((child, offset, i) => {
		if (i === index) from = offset;
	});
	return { index, from, to: from + state.doc.child(index).nodeSize };
}

function moveBlock(editor: Editor, dir: -1 | 1) {
	const range = topLevelBlockRange(editor);
	if (!range) return;
	const { state, view } = editor;
	const doc = state.doc;
	const target = range.index + dir;
	if (target < 0 || target >= doc.childCount) return;
	const node = doc.child(range.index);
	const tr = state.tr.delete(range.from, range.to);
	let insertPos: number;
	if (dir === -1) {
		let prevOffset = 0;
		doc.forEach((_child, offset, i) => { if (i === target) prevOffset = offset; });
		insertPos = prevOffset;
	} else {
		insertPos = range.from + doc.child(target).nodeSize;
	}
	tr.insert(insertPos, node);
	view.dispatch(tr.scrollIntoView());
	view.focus();
}

function deleteBlock(editor: Editor) {
	const range = topLevelBlockRange(editor);
	if (!range || editor.state.doc.childCount <= 1) return;
	editor.view.dispatch(editor.state.tr.delete(range.from, range.to).scrollIntoView());
	editor.view.focus();
}

/** Insert a block AFTER the top-level block containing the selection.
 *  Inserting at the raw selection is a trap: inside a table cell the block
 *  lands in the cell, and with an atom selected it REPLACES the atom. */
function insertAfterCurrentBlock(editor: Editor, content: object) {
	const { doc, selection } = editor.state;
	const { $from } = selection;
	const index = Math.min(
		$from.depth === 0 ? $from.indexAfter(0) : $from.index(0) + 1,
		doc.childCount,
	);
	let pos = 0;
	for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
	editor.chain().insertContentAt(pos, content).focus().scrollIntoView().run();
}

function ToolButton({
	onClick,
	active,
	disabled,
	label,
	children,
	className,
	ref,
	popoverTarget,
}: {
	onClick?: () => void;
	active?: boolean;
	disabled?: boolean;
	label: string;
	children: React.ReactNode;
	className?: string;
	ref?: React.Ref<HTMLButtonElement>;
	popoverTarget?: string;
}) {
	return (
		<button
			ref={ref}
			type="button"
			onClick={onClick}
			popoverTarget={popoverTarget}
			disabled={disabled}
			title={label}
			aria-label={label}
			aria-pressed={active}
			className={cn(
				"h-8 min-w-8 px-1.5 rounded-lg inline-flex items-center justify-center gap-1 text-xs font-medium shrink-0",
				"transition-colors active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none",
				active ? "bg-primary/10 text-primary" : "text-base-content/70 hover:bg-base-200 hover:text-base-content",
				className,
			)}
		>
			{children}
		</button>
	);
}

export function Toolbar({
	editor,
	onReset,
	locked,
	orientation = "horizontal",
}: {
	editor: Editor;
	onReset?: () => void;
	locked?: boolean;
	orientation?: "horizontal" | "vertical";
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const blockBtnRef = useRef<HTMLButtonElement>(null);
	const blockMenuRef = useRef<HTMLUListElement>(null);
	const blockMenuId = useId();
	const vertical = orientation === "vertical";

	/** The block menu is a native popover (top layer) — CSS dropdowns get
	 *  clipped by the toolbar's own scroll containers. Positioned next to the
	 *  trigger on open, clamped to the viewport. */
	function onBlockMenuToggle(e: React.SyntheticEvent<HTMLUListElement>) {
		if ((e.nativeEvent as ToggleEvent).newState !== "open") return;
		const btn = blockBtnRef.current;
		const menu = blockMenuRef.current;
		if (!btn || !menu) return;
		const r = btn.getBoundingClientRect();
		const w = menu.offsetWidth || 224;
		const h = menu.offsetHeight || 260;
		const left = Math.max(8, Math.min(vertical ? r.right + 10 : r.left, window.innerWidth - w - 8));
		const top = Math.max(8, Math.min(vertical ? r.top : r.bottom + 6, window.innerHeight - h - 8));
		menu.style.left = `${left}px`;
		menu.style.top = `${top}px`;
	}

	function insertBlock(content: object) {
		blockMenuRef.current?.hidePopover();
		insertAfterCurrentBlock(editor, content);
	}
	const state = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			bold: e.isActive("bold"),
			underline: e.isActive("underline"),
			bulletList: e.isActive("bulletList"),
			orderedList: e.isActive("orderedList"),
			heading2: e.isActive("heading", { level: 2 }),
			heading3: e.isActive("heading", { level: 3 }),
			inTable: e.isActive("table"),
			canUndo: e.can().undo(),
			canRedo: e.can().redo(),
		}),
	});

	async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
			toast.error("Yalnızca PNG veya JPEG görseller eklenebilir.");
			return;
		}
		const { count, bytes } = countImages(editor.getJSON());
		if (count >= MAX_IMAGES) {
			toast.error(`Bir belgeye en fazla ${MAX_IMAGES} görsel eklenebilir.`);
			return;
		}
		try {
			const { default: compress } = await import("browser-image-compression");
			const compressed = await compress(file, {
				maxSizeMB: 0.3,
				maxWidthOrHeight: 1400,
				// Keep PNG as PNG — re-encoding to JPEG turns transparency into
				// black boxes (react-pdf renders both formats fine).
				fileType: file.type === "image/png" ? "image/png" : "image/jpeg",
				useWebWorker: true,
			});
			if (bytes + compressed.size > MAX_TOTAL_IMAGE_BYTES) {
				toast.error("Görsel sınırı aşıldı — belge başına en fazla 4 MB görsel eklenebilir.");
				return;
			}
			const src = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = () => reject(new Error("read failed"));
				reader.readAsDataURL(compressed);
			});
			const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
				const img = new window.Image();
				img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
				img.onerror = () => reject(new Error("decode failed"));
				img.src = src;
			});
			insertAfterCurrentBlock(editor, {
				type: "image",
				attrs: { src, width: dims.w, height: dims.h },
			});
		} catch {
			toast.error("Görsel eklenemedi — dosyayı kontrol edip yeniden deneyin.");
		}
	}

	const divider = (
		<span
			className={cn("bg-base-300 shrink-0", vertical ? "h-px w-5 my-0.5" : "mx-0.5 h-5 w-px")}
			aria-hidden
		/>
	);

	return (
		<div
			className={cn(
				vertical
					? "flex flex-col items-center gap-0.5 rounded-2xl border border-base-300 bg-base-100/95 backdrop-blur p-1.5 shadow-lg max-h-[calc(100dvh-5rem)] overflow-y-auto"
					: "sticky top-0 z-20 -mx-1 px-1 py-1.5 bg-base-100/95 backdrop-blur border-b border-base-300",
			)}
		>
			<div className={cn("flex gap-0.5", vertical ? "flex-col items-center" : "items-center overflow-x-auto scrollbar-none")}>
				<ToolButton label="Geri al" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
					<Undo2 className="w-4 h-4" />
				</ToolButton>
				<ToolButton label="Yinele" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
					<Redo2 className="w-4 h-4" />
				</ToolButton>

				{divider}

				<ToolButton label="Başlık" active={state.heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
					<span className="text-[13px] font-bold">B1</span>
				</ToolButton>
				<ToolButton label="Alt başlık" active={state.heading3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
					<span className="text-[13px] font-bold">B2</span>
				</ToolButton>
				<ToolButton label="Kalın" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
					<Bold className="w-4 h-4" />
				</ToolButton>
				<ToolButton label="Altı çizili" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
					<Underline className="w-4 h-4" />
				</ToolButton>

				{divider}

				<ToolButton label="Madde işaretli liste" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
					<List className="w-4 h-4" />
				</ToolButton>
				<ToolButton label="Numaralı liste" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
					<ListOrdered className="w-4 h-4" />
				</ToolButton>
				<ToolButton
					label="Tablo ekle"
					active={state.inTable}
					onClick={() => insertBlock({
						type: "table",
						content: [
							{
								type: "tableRow",
								content: Array.from({ length: 3 }, () => ({ type: "tableHeader", content: [{ type: "paragraph" }] })),
							},
							...Array.from({ length: 2 }, () => ({
								type: "tableRow",
								content: Array.from({ length: 3 }, () => ({ type: "tableCell", content: [{ type: "paragraph" }] })),
							})),
						],
					})}
				>
					<TableIcon className="w-4 h-4" />
				</ToolButton>
				<ToolButton label="Görsel ekle" onClick={() => fileRef.current?.click()}>
					<ImagePlus className="w-4 h-4" />
				</ToolButton>
				<input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPickImage} />
				<ToolButton
					label="Not kutusu"
					onClick={() => insertBlock({ type: "callout", attrs: { tone: "note" }, content: [{ type: "text", text: "Not…" }] })}
				>
					<Info className="w-4 h-4" />
				</ToolButton>
				<ToolButton label="Sayfa sonu" onClick={() => insertBlock({ type: "pageBreak" })}>
					<Scissors className="w-4 h-4" />
				</ToolButton>

				{divider}

				{/* Structured contract blocks — native popover so the menu is never
				    clipped by the toolbar's scroll/overflow containers. */}
				<ToolButton ref={blockBtnRef} popoverTarget={blockMenuId} label="Blok ekle">
					<Plus className="w-4 h-4" /> {!vertical && <span className="hidden sm:inline">Blok</span>}
				</ToolButton>
				<ul
					id={blockMenuId}
					ref={blockMenuRef}
					popover="auto"
					onToggle={onBlockMenuToggle}
					className="menu m-0 w-56 rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-lg text-sm"
					style={{ position: "fixed", inset: "auto" }}
				>
					<li>
						<button type="button" onClick={() => insertBlock({ type: "sectionChip", attrs: { letter: null, title: "Yeni Bölüm" } })}>
							<Tag className="w-4 h-4" /> Bölüm etiketi
						</button>
					</li>
					<li>
						<button type="button" onClick={() => insertBlock({ type: "kvCard", attrs: { title: null, items: [{ label: "", value: "" }] } })}>
							<Rows3 className="w-4 h-4" /> Bilgi kartı
						</button>
					</li>
					<li>
						<button
							type="button"
							onClick={() => insertBlock({
								type: "moneyPair",
								attrs: {
									left: { label: "Tutar", value: "", currency: "TRY" },
									right: { label: "Tutar", value: "", currency: "TRY" },
								},
							})}
						>
							<LayoutList className="w-4 h-4" /> Tutar kutuları
						</button>
					</li>
					<li>
						<button
							type="button"
							onClick={() => insertBlock({ type: "clauseList", content: [{ type: "clause", content: [{ type: "text", text: "Yeni madde" }] }] })}
						>
							<ListOrdered className="w-4 h-4" /> Madde listesi
						</button>
					</li>
					<li>
						<button
							type="button"
							onClick={() => insertBlock({ type: "signatureBlock", attrs: { date: null, signers: [{ role: "Taraf 1" }, { role: "Taraf 2" }] } })}
						>
							<PenLine className="w-4 h-4" /> İmza bloğu
						</button>
					</li>
				</ul>

				{/* Table context controls */}
				{state.inTable && (
					<>
						{divider}
						<ToolButton label="Altına satır ekle" onClick={() => editor.chain().focus().addRowAfter().run()}>
							<BetweenHorizontalStart className="w-4 h-4" />
							{!vertical && <span className="whitespace-nowrap">Satır</span>}
						</ToolButton>
						<ToolButton label="Sağına sütun ekle" onClick={() => editor.chain().focus().addColumnAfter().run()}>
							<BetweenVerticalStart className="w-4 h-4" />
							{!vertical && <span className="whitespace-nowrap">Sütun</span>}
						</ToolButton>
						<ToolButton label="Satırı sil" onClick={() => editor.chain().focus().deleteRow().run()}>
							<TableRowsSplit className="w-4 h-4" />
						</ToolButton>
						<ToolButton label="Sütunu sil" onClick={() => editor.chain().focus().deleteColumn().run()}>
							<TableColumnsSplit className="w-4 h-4" />
						</ToolButton>
						<ToolButton label="Tabloyu sil" onClick={() => editor.chain().focus().deleteTable().run()}>
							<Grid2x2X className="w-4 h-4" />
						</ToolButton>
					</>
				)}

				{/* Touch fallback for drag-reorder (handles are hidden on coarse pointers) */}
				<span className="hidden pointer-coarse:contents">
					{divider}
					<ToolButton label="Bloğu yukarı taşı" onClick={() => moveBlock(editor, -1)}>
						<ArrowUp className="w-4 h-4" />
					</ToolButton>
					<ToolButton label="Bloğu aşağı taşı" onClick={() => moveBlock(editor, 1)}>
						<ArrowDown className="w-4 h-4" />
					</ToolButton>
					<ToolButton label="Bloğu sil" onClick={() => deleteBlock(editor)}>
						<Trash2 className="w-4 h-4" />
					</ToolButton>
				</span>

				{!vertical && <span className="flex-1" aria-hidden />}

				{onReset && (
					<>
						{vertical && divider}
						<ToolButton label="Şablona sıfırla" disabled={locked} onClick={onReset}>
							<RotateCcw className="w-4 h-4" />
							{!vertical && <span className="hidden md:inline whitespace-nowrap">Şablona sıfırla</span>}
						</ToolButton>
					</>
				)}
			</div>
		</div>
	);
}
