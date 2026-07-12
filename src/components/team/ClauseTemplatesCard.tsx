"use client";

/**
 * ClauseTemplatesCard — owner-only card on /team: edit the team's standard
 * contract clauses (T&C) per document kind. Clause text may contain
 * {placeholder} tokens that are resolved with the actual lease/sale values
 * when a document is generated. An absent template = built-in defaults.
 * RLS enforces owner-only writes; the card is rendered only for owners.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useAppStore } from "@/src/store";
import {
	deleteClauseTemplate,
	getClauseTemplate,
	upsertClauseTemplate,
} from "@/src/lib/db/clauseTemplates";
import { defaultClauses } from "@/src/lib/documents/clauses";
import {
	PLACEHOLDERS_BY_KIND,
	findUnknownTokens,
	type TemplateKind,
} from "@/src/lib/documents/placeholders";
import { Card, CardLabel, Button, Alert, Textarea, ConfirmDialog, toast, cn } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

const KIND_LABELS: Record<TemplateKind, string> = {
	rental: "Kira sözleşmesi",
	sales: "Satış sözleşmesi",
};

export function ClauseTemplatesCard() {
	const team = useAppStore((s) => s.team);
	const [tab, setTab] = useState<TemplateKind>("rental");
	// null = still loading from the DB
	const [rows, setRows] = useState<Record<TemplateKind, string[] | null>>({ rental: null, sales: null });
	// whether the team currently has a saved override for the kind
	const [isCustom, setIsCustom] = useState<Record<TemplateKind, boolean>>({ rental: false, sales: false });
	const [dirty, setDirty] = useState<Record<TemplateKind, boolean>>({ rental: false, sales: false });
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [confirmReset, setConfirmReset] = useState(false);

	// Where to insert a placeholder chip: the last focused clause textarea.
	const focusedRow = useRef<{ kind: TemplateKind; index: number } | null>(null);
	const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const [rental, sales] = await Promise.all([
					getClauseTemplate("rental"),
					getClauseTemplate("sales"),
				]);
				if (cancelled) return;
				setRows({
					rental: rental ?? defaultClauses("rental"),
					sales: sales ?? defaultClauses("sales"),
				});
				setIsCustom({ rental: rental != null, sales: sales != null });
			} catch (e) {
				if (!cancelled) setError(humanizeError(e));
			}
		})();
		return () => { cancelled = true; };
	}, []);

	if (!team) return null;
	const locked = !team.is_writable;
	const clauses = rows[tab];

	function patch(kind: TemplateKind, next: string[]) {
		setRows((r) => ({ ...r, [kind]: next }));
		setDirty((d) => ({ ...d, [kind]: true }));
	}

	function updateClause(index: number, value: string) {
		if (!clauses) return;
		patch(tab, clauses.map((c, i) => (i === index ? value : c)));
	}

	function moveClause(index: number, dir: -1 | 1) {
		if (!clauses) return;
		const j = index + dir;
		if (j < 0 || j >= clauses.length) return;
		const next = [...clauses];
		[next[index], next[j]] = [next[j], next[index]];
		patch(tab, next);
	}

	function removeClause(index: number) {
		if (!clauses || clauses.length <= 1) return;
		patch(tab, clauses.filter((_, i) => i !== index));
	}

	function addClause() {
		if (!clauses) return;
		patch(tab, [...clauses, ""]);
	}

	function insertToken(token: string) {
		if (!clauses) return;
		const target = focusedRow.current?.kind === tab ? focusedRow.current.index : clauses.length - 1;
		const el = textareaRefs.current.get(`${tab}:${target}`);
		const text = clauses[target] ?? "";
		const at = el && document.activeElement === el ? el.selectionStart ?? text.length : text.length;
		const chip = `{${token}}`;
		updateClause(target, text.slice(0, at) + chip + text.slice(at));
		// restore focus + caret right after the inserted token
		requestAnimationFrame(() => {
			el?.focus();
			el?.setSelectionRange(at + chip.length, at + chip.length);
		});
	}

	async function onSave() {
		if (!clauses) return;
		setError(null);
		setBusy("save");
		try {
			await upsertClauseTemplate(tab, clauses);
			setIsCustom((c) => ({ ...c, [tab]: true }));
			setDirty((d) => ({ ...d, [tab]: false }));
			toast.success("Sözleşme maddeleri kaydedildi — yeni belgeler bu maddelerle başlar.");
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setBusy(null);
		}
	}

	async function onResetConfirmed() {
		setConfirmReset(false);
		setError(null);
		setBusy("reset");
		try {
			await deleteClauseTemplate(tab);
			setRows((r) => ({ ...r, [tab]: defaultClauses(tab) }));
			setIsCustom((c) => ({ ...c, [tab]: false }));
			setDirty((d) => ({ ...d, [tab]: false }));
			toast.success("Varsayılan maddelere dönüldü.");
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setBusy(null);
		}
	}

	return (
		<Card>
			<CardLabel>Sözleşme maddeleri</CardLabel>
			<p className="text-xs text-base-content/60 mt-1">
				Sözleşmelerinizin standart maddelerini ofisinize göre düzenleyin. Süslü parantezli
				alanlar (ör. <code className="font-mono text-[11px]">{"{monthly_rent}"}</code>) belge
				oluşturulurken gerçek değerlerle doldurulur. Değişiklikler yalnızca yeni belgeleri etkiler.
			</p>

			{error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

			{locked && (
				<div className="mt-3">
					<Alert tone="warning">
						Ücretsiz deneme süreniz doldu. Sözleşme maddelerini düzenlemek için
						aboneliğinizi yeniden başlatın.
					</Alert>
				</div>
			)}

			{/* Kind tabs */}
			<div className="mt-4 flex gap-1 rounded-xl bg-base-200 p-1 w-fit" role="tablist" aria-label="Belge türü">
				{(Object.keys(KIND_LABELS) as TemplateKind[]).map((k) => (
					<button
						key={k}
						type="button"
						role="tab"
						aria-selected={tab === k}
						onClick={() => setTab(k)}
						className={cn(
							"px-3 h-9 rounded-lg text-sm font-medium transition-colors",
							tab === k
								? "bg-base-100 text-base-content shadow-sm"
								: "text-base-content/60 hover:text-base-content",
						)}
					>
						{KIND_LABELS[k]}
						{isCustom[k] && <span className="ml-1.5 text-primary" aria-label="özelleştirilmiş">•</span>}
					</button>
				))}
			</div>

			{clauses === null ? (
				<p className="mt-4 text-sm text-base-content/50">Maddeler yükleniyor…</p>
			) : (
				<>
					<ol className="mt-4 space-y-3">
						{clauses.map((clause, i) => {
							const unknown = findUnknownTokens(tab, clause);
							return (
								<li key={i} className="flex gap-2">
									<span className="w-7 pt-2.5 text-right text-xs font-bold tabular-nums text-base-content/40 shrink-0">
										{i + 1}.
									</span>
									<div className="flex-1 min-w-0">
										<Textarea
											ref={(el) => {
												if (el) textareaRefs.current.set(`${tab}:${i}`, el);
												else textareaRefs.current.delete(`${tab}:${i}`);
											}}
											value={clause}
											rows={2}
											disabled={locked}
											className="min-h-16 [field-sizing:content] text-[13px]"
											onFocus={() => { focusedRow.current = { kind: tab, index: i }; }}
											onChange={(e) => updateClause(i, e.target.value)}
											aria-label={`Madde ${i + 1}`}
										/>
										{unknown.length > 0 && (
											<p className="mt-1 text-xs text-warning">
												Bilinmeyen alan: {unknown.map((t) => `{${t}}`).join(", ")} — bu alanlar
												belgede olduğu gibi görünür.
											</p>
										)}
									</div>
									<div className="flex flex-col gap-0.5 pt-1 shrink-0">
										<Button variant="ghost" size="sm" disabled={locked || i === 0} onClick={() => moveClause(i, -1)} aria-label={`Madde ${i + 1} yukarı taşı`}>
											<ArrowUp className="w-3.5 h-3.5" />
										</Button>
										<Button variant="ghost" size="sm" disabled={locked || i === clauses.length - 1} onClick={() => moveClause(i, 1)} aria-label={`Madde ${i + 1} aşağı taşı`}>
											<ArrowDown className="w-3.5 h-3.5" />
										</Button>
										<Button variant="ghost" size="sm" disabled={locked || clauses.length <= 1} onClick={() => removeClause(i)} aria-label={`Madde ${i + 1} sil`}>
											<Trash2 className="w-3.5 h-3.5" />
										</Button>
									</div>
								</li>
							);
						})}
					</ol>

					<Button variant="outline" size="sm" className="mt-3" disabled={locked} onClick={addClause}>
						<Plus className="w-4 h-4" /> Madde ekle
					</Button>

					{/* Placeholder chip legend */}
					<div className="mt-5">
						<p className="text-xs font-semibold text-base-content/70 mb-2">
							Doldurulabilir alanlar — eklemek için tıklayın
						</p>
						<div className="flex flex-wrap gap-1.5">
							{PLACEHOLDERS_BY_KIND[tab].map((p) => (
								<button
									key={p.token}
									type="button"
									disabled={locked}
									onClick={() => insertToken(p.token)}
									title={`Örnek: ${p.example}`}
									className="rounded-lg border border-base-300 bg-base-200 px-2 py-1 font-mono text-[11px] text-base-content/70 hover:border-base-content/30 hover:text-base-content transition-colors disabled:opacity-50"
								>
									{`{${p.token}}`}
									<span className="ml-1 font-sans text-base-content/50">{p.label}</span>
								</button>
							))}
						</div>
					</div>

					<div className="mt-5 flex items-center justify-between gap-2">
						<Button
							variant="ghost"
							size="sm"
							disabled={locked || (!isCustom[tab] && !dirty[tab])}
							loading={busy === "reset"}
							onClick={() => setConfirmReset(true)}
						>
							<RotateCcw className="w-4 h-4" /> Varsayılana dön
						</Button>
						<Button
							disabled={locked || !dirty[tab]}
							loading={busy === "save"}
							onClick={onSave}
						>
							Kaydet
						</Button>
					</div>
				</>
			)}

			<ConfirmDialog
				open={confirmReset}
				title="Varsayılan maddelere dönülsün mü?"
				message={`${KIND_LABELS[tab]} için yaptığınız tüm madde değişiklikleri silinir ve yeni belgeler yerleşik maddelerle oluşturulur.`}
				confirmLabel="Varsayılana dön"
				cancelLabel="Vazgeç"
				onConfirm={onResetConfirmed}
				onCancel={() => setConfirmReset(false)}
			/>
		</Card>
	);
}
