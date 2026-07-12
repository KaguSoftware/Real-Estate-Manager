"use client";

/**
 * React node views for the contract editor's structured blocks. Each view
 * edits its node's attrs in place (updateAttributes) and visually mirrors
 * the PDF primitive it maps to (src/lib/pdf/editorDoc.tsx), so the sheet
 * reads like the final document.
 *
 * All views are Tiptap-only; the persisted JSON contract lives in
 * src/lib/documents/blocks.ts.
 */

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Plus, Trash2, TriangleAlert, Info } from "lucide-react";
import type {
	KVCardAttrs,
	MoneyPairAttrs,
	PartyCardAttrs,
	SectionChipAttrs,
	SignatureBlockAttrs,
	CalloutAttrs,
	MoneyCell,
} from "@/src/lib/documents/blocks";
import type { PartyInfo } from "@/src/lib/pdf/types";
import { cn } from "@/src/components/ui";

/** Borderless inline input that looks like document text until focused. */
function GhostInput({
	value,
	onChange,
	placeholder,
	className,
	disabled,
	"aria-label": ariaLabel,
}: {
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	"aria-label"?: string;
}) {
	return (
		<input
			type="text"
			value={value}
			disabled={disabled}
			placeholder={placeholder}
			aria-label={ariaLabel}
			onChange={(e) => onChange(e.target.value)}
			className={cn(
				"w-full bg-transparent outline-none rounded px-1 -mx-1",
				"focus:bg-primary/5 focus:ring-1 focus:ring-primary/30",
				"placeholder:text-base-content/30 disabled:cursor-default",
				className,
			)}
		/>
	);
}

// ── Section chip ─────────────────────────────────────────────────────────────
export function SectionChipView({ node, updateAttributes, editor }: NodeViewProps) {
	const attrs = node.attrs as SectionChipAttrs;
	const editable = editor.isEditable;
	return (
		<NodeViewWrapper className="doc-block flex items-center gap-2 mt-5 mb-2" data-drag-handle>
			<span className="h-2 w-2 shrink-0 bg-[var(--doc-accent)]" aria-hidden />
			{attrs.letter ? (
				<GhostInput
					value={attrs.letter}
					disabled={!editable}
					onChange={(v) => updateAttributes({ letter: v.toLocaleUpperCase("tr").slice(0, 2) })}
					aria-label="Bölüm harfi"
					className="w-7 max-w-7 text-xs font-bold tracking-widest uppercase text-[var(--doc-primary)] text-center"
				/>
			) : null}
			<GhostInput
				value={attrs.title}
				disabled={!editable}
				onChange={(v) => updateAttributes({ title: v })}
				placeholder="Bölüm başlığı"
				aria-label="Bölüm başlığı"
				className="text-xs font-bold tracking-widest uppercase text-[var(--doc-primary)]"
			/>
		</NodeViewWrapper>
	);
}

// ── Party card ───────────────────────────────────────────────────────────────
const PARTY_FIELDS: { key: keyof PartyInfo; label: string }[] = [
	{ key: "address", label: "Adres" },
	{ key: "national_id", label: "T.C. Kimlik" },
	{ key: "tax_no", label: "Vergi No" },
	{ key: "tax_office", label: "Vergi Dairesi" },
	{ key: "phone", label: "Telefon" },
	{ key: "email", label: "E-posta" },
];

export function PartyCardView({ node, updateAttributes, editor }: NodeViewProps) {
	const attrs = node.attrs as PartyCardAttrs;
	const editable = editor.isEditable;
	const party = attrs.party ?? ({ full_name: "", address: "" } as PartyInfo);
	const patch = (key: keyof PartyInfo, v: string) =>
		updateAttributes({ party: { ...party, [key]: v || null } });
	const initial = (party.full_name || attrs.role || "?").trim().charAt(0).toLocaleUpperCase("tr");

	return (
		<NodeViewWrapper className="doc-block mb-3" data-drag-handle>
			<div className="rounded border border-base-300 px-3.5 py-3">
				<div className="flex items-center gap-2 mb-2">
					<span className="h-5 w-5 shrink-0 rounded-sm bg-[var(--doc-tint)] text-[var(--doc-primary)] text-[11px] font-bold flex items-center justify-center">
						{initial}
					</span>
					<div className="min-w-0 flex-1">
						<GhostInput
							value={attrs.role}
							disabled={!editable}
							onChange={(v) => updateAttributes({ role: v })}
							aria-label="Taraf rolü"
							className="text-[10px] font-medium uppercase tracking-widest text-[var(--doc-accent)]"
						/>
						<GhostInput
							value={party.full_name}
							disabled={!editable}
							onChange={(v) => updateAttributes({ party: { ...party, full_name: v } })}
							placeholder="Adı Soyadı / Firma"
							aria-label="Adı soyadı"
							className="text-sm font-bold text-base-content"
						/>
					</div>
				</div>
				<div className="space-y-1">
					{PARTY_FIELDS.map((f) => (
						<div key={f.key} className="flex items-baseline gap-2">
							<span className="w-24 shrink-0 text-[11px] font-medium text-base-content/50">{f.label}</span>
							<GhostInput
								value={(party[f.key] as string | null) ?? ""}
								disabled={!editable}
								onChange={(v) => patch(f.key, v)}
								placeholder="—"
								aria-label={f.label}
								className="text-[13px] text-base-content/90"
							/>
						</div>
					))}
				</div>
			</div>
		</NodeViewWrapper>
	);
}

// ── Key/value card ───────────────────────────────────────────────────────────
export function KVCardView({ node, updateAttributes, editor }: NodeViewProps) {
	const attrs = node.attrs as KVCardAttrs;
	const editable = editor.isEditable;
	const items = Array.isArray(attrs.items) ? attrs.items : [];

	const setItems = (next: KVCardAttrs["items"]) => updateAttributes({ items: next });
	const patch = (i: number, key: "label" | "value", v: string) =>
		setItems(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));

	return (
		<NodeViewWrapper className="doc-block mb-3" data-drag-handle>
			<div className="rounded border border-base-300 px-3.5 py-3">
				{attrs.title != null && (
					<GhostInput
						value={attrs.title}
						disabled={!editable}
						onChange={(v) => updateAttributes({ title: v })}
						placeholder="Başlık"
						aria-label="Kart başlığı"
						className="text-sm font-bold text-base-content mb-1.5"
					/>
				)}
				<div className="divide-y divide-base-200">
					{items.map((it, i) => (
						<div key={i} className="group/row flex items-center gap-2 py-1">
							<GhostInput
								value={it.label}
								disabled={!editable}
								onChange={(v) => patch(i, "label", v)}
								placeholder="Etiket"
								aria-label={`Satır ${i + 1} etiketi`}
								className="w-36 max-w-36 text-[11px] font-medium text-base-content/50"
							/>
							<GhostInput
								value={it.value}
								disabled={!editable}
								onChange={(v) => patch(i, "value", v)}
								placeholder="—"
								aria-label={`Satır ${i + 1} değeri`}
								className="text-[13px] font-semibold text-base-content text-right"
							/>
							{editable && (
								<button
									type="button"
									tabIndex={-1}
									onClick={() => setItems(items.filter((_, j) => j !== i))}
									className="opacity-0 group-hover/row:opacity-60 hover:!opacity-100 transition-opacity"
									aria-label={`Satır ${i + 1} sil`}
								>
									<Trash2 className="w-3.5 h-3.5" />
								</button>
							)}
						</div>
					))}
				</div>
				{editable && (
					<button
						type="button"
						onClick={() => setItems([...items, { label: "", value: "" }])}
						className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-base-content/50 hover:text-base-content transition-colors"
					>
						<Plus className="w-3 h-3" /> Satır ekle
					</button>
				)}
			</div>
		</NodeViewWrapper>
	);
}

// ── Money pair ───────────────────────────────────────────────────────────────
function MoneyBox({
	cell,
	variant,
	editable,
	onChange,
}: {
	cell: MoneyCell;
	variant: "filled" | "outlined";
	editable: boolean;
	onChange: (c: MoneyCell) => void;
}) {
	const filled = variant === "filled";
	return (
		<div
			className={cn(
				"flex-1 rounded px-4 py-3",
				filled ? "bg-[var(--doc-primary)]" : "border border-[var(--doc-accent)]",
			)}
		>
			<GhostInput
				value={cell.label}
				disabled={!editable}
				onChange={(v) => onChange({ ...cell, label: v })}
				aria-label="Tutar etiketi"
				className={cn(
					"text-[10px] font-medium uppercase tracking-widest mb-1",
					filled ? "text-white/60 focus:bg-white/10" : "text-[var(--doc-accent)]",
				)}
			/>
			<div className="flex items-baseline gap-1.5">
				<GhostInput
					value={cell.value}
					disabled={!editable}
					onChange={(v) => onChange({ ...cell, value: v })}
					placeholder="0"
					aria-label="Tutar"
					className={cn(
						"text-xl font-bold tabular-nums",
						filled ? "text-white focus:bg-white/10" : "text-[var(--doc-primary)]",
					)}
				/>
				<GhostInput
					value={cell.currency}
					disabled={!editable}
					onChange={(v) => onChange({ ...cell, currency: v.toUpperCase().slice(0, 4) })}
					aria-label="Para birimi"
					className={cn(
						"w-12 max-w-12 text-xs font-bold",
						filled ? "text-white/60 focus:bg-white/10" : "text-[var(--doc-accent)]",
					)}
				/>
			</div>
		</div>
	);
}

export function MoneyPairView({ node, updateAttributes, editor }: NodeViewProps) {
	const attrs = node.attrs as MoneyPairAttrs;
	const editable = editor.isEditable;
	return (
		<NodeViewWrapper className="doc-block mb-3" data-drag-handle>
			<div className="flex flex-col sm:flex-row gap-3">
				<MoneyBox cell={attrs.left} variant="filled" editable={editable} onChange={(c) => updateAttributes({ left: c })} />
				<MoneyBox cell={attrs.right} variant="outlined" editable={editable} onChange={(c) => updateAttributes({ right: c })} />
			</div>
		</NodeViewWrapper>
	);
}

// ── Signature block ──────────────────────────────────────────────────────────
export function SignatureBlockView({ node, updateAttributes, editor }: NodeViewProps) {
	const attrs = node.attrs as SignatureBlockAttrs;
	const editable = editor.isEditable;
	const signers = Array.isArray(attrs.signers) ? attrs.signers : [];
	const setSigners = (next: SignatureBlockAttrs["signers"]) => updateAttributes({ signers: next });

	return (
		<NodeViewWrapper className="doc-block mt-6 mb-3" data-drag-handle>
			<div className="flex items-center gap-2.5 mb-1">
				<span className="text-sm font-bold text-base-content">İmzalar</span>
				<span className="h-px flex-1 bg-base-300" aria-hidden />
			</div>
			{attrs.date != null && (
				<div className="flex items-baseline gap-1 text-xs text-base-content/50">
					<span>Tarih:</span>
					<GhostInput
						value={attrs.date}
						disabled={!editable}
						onChange={(v) => updateAttributes({ date: v })}
						aria-label="İmza tarihi"
						className="text-xs text-base-content/70"
					/>
				</div>
			)}
			<div className="mt-6 flex flex-col sm:flex-row gap-6">
				{signers.map((s, i) => (
					<div key={i} className="group/sig flex-1 min-w-0">
						<div className="h-8 border-b border-[var(--doc-primary)]" aria-hidden />
						<div className="mt-1.5 flex items-start gap-1">
							<div className="min-w-0 flex-1">
								<GhostInput
									value={s.role}
									disabled={!editable}
									onChange={(v) => setSigners(signers.map((x, j) => (j === i ? { ...x, role: v } : x)))}
									placeholder="Rol"
									aria-label={`İmzacı ${i + 1} rolü`}
									className="text-[13px] font-bold text-base-content"
								/>
								<GhostInput
									value={s.name ?? ""}
									disabled={!editable}
									onChange={(v) => setSigners(signers.map((x, j) => (j === i ? { ...x, name: v || undefined } : x)))}
									placeholder="Ad Soyad"
									aria-label={`İmzacı ${i + 1} adı`}
									className="text-xs text-base-content/60"
								/>
								<p className="text-[10px] text-base-content/40 mt-0.5">Ad Soyad / İmza</p>
							</div>
							{editable && signers.length > 1 && (
								<button
									type="button"
									tabIndex={-1}
									onClick={() => setSigners(signers.filter((_, j) => j !== i))}
									className="opacity-0 group-hover/sig:opacity-60 hover:!opacity-100 transition-opacity"
									aria-label={`İmzacı ${i + 1} sil`}
								>
									<Trash2 className="w-3.5 h-3.5" />
								</button>
							)}
						</div>
					</div>
				))}
			</div>
			{editable && signers.length < 4 && (
				<button
					type="button"
					onClick={() => setSigners([...signers, { role: "" }])}
					className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-base-content/50 hover:text-base-content transition-colors"
				>
					<Plus className="w-3 h-3" /> İmzacı ekle
				</button>
			)}
		</NodeViewWrapper>
	);
}

// ── Callout ──────────────────────────────────────────────────────────────────
export function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
	const tone = (node.attrs as CalloutAttrs).tone === "warning" ? "warning" : "note";
	const editable = editor.isEditable;
	return (
		<NodeViewWrapper className="doc-block mb-3" data-drag-handle>
			<div
				className={cn(
					"flex items-start gap-2 rounded px-3 py-2.5 text-[13px]",
					tone === "warning" ? "bg-red-50 text-red-700" : "bg-[var(--doc-tint)] text-[var(--doc-primary)]",
				)}
			>
				<button
					type="button"
					contentEditable={false}
					disabled={!editable}
					onClick={() => updateAttributes({ tone: tone === "warning" ? "note" : "warning" })}
					title={tone === "warning" ? "Nota çevir" : "Uyarıya çevir"}
					aria-label="Kutu türünü değiştir"
					className="mt-0.5 shrink-0 opacity-70 hover:opacity-100 transition-opacity disabled:opacity-50"
				>
					{tone === "warning" ? <TriangleAlert className="w-4 h-4" /> : <Info className="w-4 h-4" />}
				</button>
				<NodeViewContent className="min-w-0 flex-1 outline-none" />
			</div>
		</NodeViewWrapper>
	);
}
