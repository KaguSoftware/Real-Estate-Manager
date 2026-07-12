"use client";

/**
 * Contract editor toolbar. Formatting + block insertion + table context
 * controls. Desktop reorders blocks by drag handle; on coarse pointers the
 * toolbar exposes move/delete buttons instead (drag is unreliable on touch).
 */

import { useRef } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
	ArrowDown,
	ArrowUp,
	Bold,
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
	const index = $from.depth === 0 ? $from.index(0) : $from.index(0);
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

function ToolButton({
	onClick,
	active,
	disabled,
	label,
	children,
	className,
}: {
	onClick: () => void;
	active?: boolean;
	disabled?: boolean;
	label: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={label}
			aria-label={label}
			aria-pressed={active}
			className={cn(
				"h-8 min-w-8 px-1.5 rounded-lg inline-flex items-center justify-center gap-1 text-xs font-medium",
				"transition-colors active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none",
				active ? "bg-primary/10 text-primary" : "text-base-content/70 hover:bg-base-200 hover:text-base-content",
				className,
			)}
		>
			{children}
		</button>
	);
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-base-300 shrink-0" aria-hidden />;

export function Toolbar({
	editor,
	onReset,
	locked,
}: {
	editor: Editor;
	onReset?: () => void;
	locked?: boolean;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
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
				fileType: "image/jpeg",
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
			editor.chain().focus().insertContent({
				type: "image",
				attrs: { src, width: dims.w, height: dims.h },
			}).run();
		} catch {
			toast.error("Görsel eklenemedi — dosyayı kontrol edip yeniden deneyin.");
		}
	}

	const insert = (content: object) => editor.chain().focus().insertContent(content).run();

	return (
		<div className="sticky top-0 z-20 -mx-1 px-1 py-1.5 bg-base-100/95 backdrop-blur border-b border-base-300">
			<div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
				<ToolButton label="Geri al" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
					<Undo2 className="w-4 h-4" />
				</ToolButton>
				<ToolButton label="Yinele" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
					<Redo2 className="w-4 h-4" />
				</ToolButton>

				<Divider />

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

				<Divider />

				<ToolButton label="Madde işaretli liste" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
					<List className="w-4 h-4" />
				</ToolButton>
				<ToolButton label="Numaralı liste" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
					<ListOrdered className="w-4 h-4" />
				</ToolButton>
				<ToolButton
					label="Tablo ekle"
					active={state.inTable}
					onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
				>
					<TableIcon className="w-4 h-4" />
				</ToolButton>
				<ToolButton label="Görsel ekle" onClick={() => fileRef.current?.click()}>
					<ImagePlus className="w-4 h-4" />
				</ToolButton>
				<input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPickImage} />
				<ToolButton
					label="Not kutusu"
					onClick={() => insert({ type: "callout", attrs: { tone: "note" }, content: [{ type: "text", text: "Not…" }] })}
				>
					<Info className="w-4 h-4" />
				</ToolButton>
				<ToolButton label="Sayfa sonu" onClick={() => insert({ type: "pageBreak" })}>
					<Scissors className="w-4 h-4" />
				</ToolButton>

				<Divider />

				{/* Structured contract blocks */}
				<div className="dropdown">
					<ToolButton label="Blok ekle" onClick={() => { /* dropdown via focus */ }} className="dropdown-toggle">
						<Plus className="w-4 h-4" /> <span className="hidden sm:inline">Blok</span>
					</ToolButton>
					<ul className="dropdown-content menu z-30 mt-1 w-56 rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-lg text-sm">
						<li>
							<button type="button" onClick={() => insert({ type: "sectionChip", attrs: { letter: null, title: "Yeni Bölüm" } })}>
								<Tag className="w-4 h-4" /> Bölüm etiketi
							</button>
						</li>
						<li>
							<button type="button" onClick={() => insert({ type: "kvCard", attrs: { title: null, items: [{ label: "", value: "" }] } })}>
								<Rows3 className="w-4 h-4" /> Bilgi kartı
							</button>
						</li>
						<li>
							<button
								type="button"
								onClick={() => insert({
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
								onClick={() => insert({ type: "clauseList", content: [{ type: "clause", content: [{ type: "text", text: "Yeni madde" }] }] })}
							>
								<ListOrdered className="w-4 h-4" /> Madde listesi
							</button>
						</li>
						<li>
							<button
								type="button"
								onClick={() => insert({ type: "signatureBlock", attrs: { date: null, signers: [{ role: "Taraf 1" }, { role: "Taraf 2" }] } })}
							>
								<PenLine className="w-4 h-4" /> İmza bloğu
							</button>
						</li>
					</ul>
				</div>

				{/* Table context controls */}
				{state.inTable && (
					<>
						<Divider />
						<ToolButton label="Altına satır ekle" onClick={() => editor.chain().focus().addRowAfter().run()}>
							<span className="whitespace-nowrap">＋ Satır</span>
						</ToolButton>
						<ToolButton label="Sağına sütun ekle" onClick={() => editor.chain().focus().addColumnAfter().run()}>
							<span className="whitespace-nowrap">＋ Sütun</span>
						</ToolButton>
						<ToolButton label="Satırı sil" onClick={() => editor.chain().focus().deleteRow().run()}>
							<span className="whitespace-nowrap">− Satır</span>
						</ToolButton>
						<ToolButton label="Sütunu sil" onClick={() => editor.chain().focus().deleteColumn().run()}>
							<span className="whitespace-nowrap">− Sütun</span>
						</ToolButton>
						<ToolButton label="Tabloyu sil" onClick={() => editor.chain().focus().deleteTable().run()}>
							<Trash2 className="w-4 h-4" />
						</ToolButton>
					</>
				)}

				{/* Touch fallback for drag-reorder (handles are hidden on coarse pointers) */}
				<span className="hidden [@media(pointer:coarse)]:contents">
					<Divider />
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

				<span className="flex-1" aria-hidden />

				{onReset && (
					<ToolButton label="Şablona sıfırla" disabled={locked} onClick={onReset} className="shrink-0">
						<RotateCcw className="w-4 h-4" /> <span className="hidden md:inline whitespace-nowrap">Şablona sıfırla</span>
					</ToolButton>
				)}
			</div>
		</div>
	);
}
