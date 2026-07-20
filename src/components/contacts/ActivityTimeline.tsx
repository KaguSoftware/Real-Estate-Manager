"use client";

import { useCallback, useEffect, useState } from "react";
import { humanizeError } from "@/src/lib/errors";
import { useIsWritable } from "@/src/store";
import {
	listActivity, logActivity, deleteActivity,
	type ContactActivityWithAuthor,
} from "@/src/lib/db/contactActivity";
import type { ActivityKind } from "@/src/lib/db/types";
import {
	Button, Dropdown, Textarea, DatePicker, Spinner, toast, cn,
	type DropdownOption,
} from "@/src/components/ui";
import { Phone, MessageCircle, Users, Home, StickyNote, ArrowRightLeft, Plus, Trash2 } from "lucide-react";

interface Props {
	/** Exactly one of these — mirrors the DB's one-subject constraint. */
	leadId?: string;
	tenantId?: string;
}

const KIND_OPTIONS: DropdownOption<ActivityKind>[] = [
	{ value: "call", label: "Telefon" },
	{ value: "whatsapp", label: "WhatsApp" },
	{ value: "meeting", label: "Görüşme" },
	{ value: "viewing", label: "Yer gösterme" },
	{ value: "note", label: "Not" },
];

const KIND_META: Record<ActivityKind, { label: string; icon: typeof Phone; tone: string }> = {
	call:          { label: "Telefon",       icon: Phone,          tone: "text-primary" },
	whatsapp:      { label: "WhatsApp",      icon: MessageCircle,  tone: "text-success" },
	meeting:       { label: "Görüşme",       icon: Users,          tone: "text-info" },
	viewing:       { label: "Yer gösterme",  icon: Home,           tone: "text-warning" },
	note:          { label: "Not",           icon: StickyNote,     tone: "text-base-content/60" },
	status_change: { label: "Durum değişti", icon: ArrowRightLeft, tone: "text-base-content/60" },
};

function fmtWhen(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Interaction history for one contact, newest first.
 *
 * Replaces the old "[tarih] Arandı." lines that were prepended into the notes
 * textarea — those were destroyed whenever the form was saved. Entries here are
 * separate rows, attributed to whoever logged them.
 */
export function ActivityTimeline({ leadId, tenantId }: Props) {
	const isWritable = useIsWritable();

	const [items, setItems] = useState<ContactActivityWithAuthor[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [composing, setComposing] = useState(false);
	const [kind, setKind] = useState<ActivityKind>("call");
	const [body, setBody] = useState("");
	const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
	const [saving, setSaving] = useState(false);

	const subject = leadId ? { leadId } : tenantId ? { tenantId } : null;

	const reload = useCallback(async () => {
		if (!subject) return;
		setLoading(true);
		try {
			setItems(await listActivity(subject));
			setError(null);
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setLoading(false);
		}
		// subject is derived from the two id props; depending on those keeps this
		// stable across renders.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [leadId, tenantId]);

	useEffect(() => { reload(); }, [reload]);

	async function submit() {
		if (!subject) return;
		setSaving(true);
		try {
			await logActivity({
				lead_id: leadId ?? null,
				tenant_id: tenantId ?? null,
				kind,
				body: body.trim() || null,
				// Preserve the time of day when the entry is for today; a back-dated
				// entry lands at midday so ordering stays sensible.
				occurred_at: occurredOn === new Date().toISOString().slice(0, 10)
					? new Date().toISOString()
					: `${occurredOn}T12:00:00.000Z`,
			});
			setBody("");
			setKind("call");
			setOccurredOn(new Date().toISOString().slice(0, 10));
			setComposing(false);
			await reload();
			toast.success("Kayıt eklendi.");
		} catch (e) {
			toast.error(humanizeError(e));
		} finally {
			setSaving(false);
		}
	}

	async function remove(id: string) {
		try {
			await deleteActivity(id);
			setItems((cur) => cur.filter((i) => i.id !== id));
		} catch (e) {
			toast.error(humanizeError(e));
		}
	}

	if (!subject) return null;

	return (
		<div className="rounded-2xl bg-base-200 border border-base-300 p-4 space-y-3">
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm font-semibold text-base-content/60">Görüşme geçmişi</p>
				{isWritable && !composing && (
					<Button type="button" variant="outline" size="sm" onClick={() => setComposing(true)}>
						<Plus className="w-4 h-4" />
						Kayıt ekle
					</Button>
				)}
			</div>

			{composing && (
				<div className="rounded-xl bg-base-100 border border-base-300 p-3 space-y-3">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<Dropdown options={KIND_OPTIONS} value={kind} onChange={setKind} aria-label="Kayıt türü" />
						<DatePicker value={occurredOn} onChange={setOccurredOn} required aria-label="Tarih" />
					</div>
					<Textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						placeholder="Ne konuşuldu? Ne istiyor?"
						rows={2}
					/>
					<div className="flex gap-2">
						<Button type="button" variant="ghost" size="sm" block onClick={() => setComposing(false)} disabled={saving}>
							Vazgeç
						</Button>
						<Button type="button" size="sm" block onClick={submit} disabled={saving}>
							{saving ? "Kaydediliyor…" : "Kaydet"}
						</Button>
					</div>
				</div>
			)}

			{error && <p className="text-sm text-error">{error}</p>}

			{loading ? (
				<div className="py-6 flex justify-center"><Spinner /></div>
			) : items.length === 0 ? (
				<p className="text-sm text-base-content/50 py-2">
					Henüz kayıt yok. Aramalar ve görüşmeler burada birikir.
				</p>
			) : (
				<ul className="space-y-2">
					{items.map((it) => {
						const meta = KIND_META[it.kind] ?? KIND_META.note;
						const Icon = meta.icon;
						return (
							<li
								key={it.id}
								className="group flex items-start gap-3 rounded-xl bg-base-100 border border-base-300/70 px-3 py-2.5"
							>
								<Icon className={cn("w-4 h-4 mt-0.5 shrink-0", meta.tone)} />
								<div className="min-w-0 flex-1">
									<p className="text-sm">
										<span className="font-medium">{meta.label}</span>
										<span className="text-base-content/50"> · {fmtWhen(it.occurred_at)}</span>
										{it.author_name && (
											<span className="text-base-content/50"> · {it.author_name}</span>
										)}
									</p>
									{it.body && (
										<p className="text-sm text-base-content/80 mt-0.5 whitespace-pre-wrap break-words">
											{it.body}
										</p>
									)}
								</div>
								{isWritable && (
									<button
										type="button"
										onClick={() => remove(it.id)}
										aria-label="Kaydı sil"
										className="shrink-0 p-1 rounded text-base-content/30 hover:text-error hover:bg-error/10 transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
