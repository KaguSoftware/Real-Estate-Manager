"use client";

/**
 * MessageTemplateCard — owner-only card on /team: edit the wording the app
 * prefills when an agent shares a property over WhatsApp. Tokens like {adres}
 * are resolved per property at send time. An absent template = the built-in
 * default. RLS enforces owner-only writes; the card renders only for owners.
 */

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useAppStore } from "@/src/store";
import {
	getMessageTemplate,
	upsertMessageTemplate,
	deleteMessageTemplate,
} from "@/src/lib/db/messageTemplates";
import {
	DEFAULT_PROPERTY_TEMPLATE,
	MESSAGE_TOKENS,
	renderPropertyMessage,
	type ShareableProperty,
} from "@/src/lib/whatsappMessage";
import { Card, CardLabel, Button, Alert, Textarea, ConfirmDialog, toast, cn } from "@/src/components/ui";
import { humanizeError } from "@/src/lib/errors";

/** Stand-in property so the owner sees the real shape of the message. */
const PREVIEW_PROPERTY: ShareableProperty = {
	address_line: "Kıbrıs Şehitleri Cd. 10",
	city: "İzmir",
	nitelik: "3+1",
	size_sqm: 120,
	bedrooms: 3,
	listing_type: "for_sale",
	list_price: 5_000_000,
	currency: "TRY",
};

export function MessageTemplateCard() {
	const team = useAppStore((s) => s.team);
	const [body, setBody] = useState<string | null>(null); // null = loading
	const [isCustom, setIsCustom] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirmReset, setConfirmReset] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const bodyId = useId();
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	// Load on first expand — owner-only card, no need to fetch for everyone.
	useEffect(() => {
		if (!expanded || body !== null) return;
		let cancelled = false;
		getMessageTemplate()
			.then((saved) => {
				if (cancelled) return;
				setIsCustom(saved !== null);
				setBody(saved ?? DEFAULT_PROPERTY_TEMPLATE);
			})
			.catch((e) => { if (!cancelled) setError(humanizeError(e)); });
		return () => { cancelled = true; };
	}, [expanded, body]);

	/** Insert a token at the cursor so owners don't have to type braces. */
	function insertToken(token: string) {
		const el = textareaRef.current;
		if (!el || body === null) return;
		const start = el.selectionStart ?? body.length;
		const end = el.selectionEnd ?? body.length;
		const next = body.slice(0, start) + token + body.slice(end);
		setBody(next);
		setDirty(true);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(start + token.length, start + token.length);
		});
	}

	async function save() {
		if (!body?.trim()) { setError("Şablon boş olamaz."); return; }
		setBusy(true);
		setError(null);
		try {
			await upsertMessageTemplate(body);
			setIsCustom(true);
			setDirty(false);
			toast.success("Mesaj şablonu kaydedildi.");
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setBusy(false);
		}
	}

	async function reset() {
		setBusy(true);
		try {
			await deleteMessageTemplate();
			setBody(DEFAULT_PROPERTY_TEMPLATE);
			setIsCustom(false);
			setDirty(false);
			setConfirmReset(false);
			toast.success("Varsayılan şablona dönüldü.");
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setBusy(false);
		}
	}

	if (!team) return null;

	const preview =
		body !== null
			? renderPropertyMessage(
					PREVIEW_PROPERTY,
					{ recipientName: "Ahmet Bey", senderName: team.name },
					body,
				)
			: "";

	return (
		<Card padded={false}>
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				aria-expanded={expanded}
				aria-controls={bodyId}
				className="w-full flex items-center justify-between gap-3 p-6 text-left"
			>
				<span className="min-w-0">
					<CardLabel>WhatsApp mesaj şablonu</CardLabel>
					<span className="block text-sm text-base-content/60 mt-0.5">
						Taşınmaz paylaşırken hazır gelen metin.
						{isCustom ? " Özelleştirilmiş." : " Varsayılan kullanılıyor."}
					</span>
				</span>
				<ChevronDown
					className={cn("w-4 h-4 shrink-0 text-base-content/50 transition-transform", expanded && "rotate-180")}
				/>
			</button>

			{expanded && (
				<div id={bodyId} className="px-6 pb-6 space-y-4">
					{error && <Alert>{error}</Alert>}

					{body === null ? (
						<p className="text-sm text-base-content/50">Yükleniyor…</p>
					) : (
						<>
							<div>
								<p className="text-sm font-medium mb-1.5">Şablon</p>
								<Textarea
									ref={textareaRef}
									value={body}
									onChange={(e) => { setBody(e.target.value); setDirty(true); }}
									rows={8}
									className="font-mono text-sm"
								/>
							</div>

							<div>
								<p className="text-sm font-medium mb-1.5">Kullanılabilir alanlar</p>
								<div className="flex flex-wrap gap-1.5">
									{MESSAGE_TOKENS.map((t) => (
										<button
											key={t.token}
											type="button"
											onClick={() => insertToken(t.token)}
											title={t.description}
											className="px-2 py-1 rounded-lg border border-base-300 bg-base-200 text-xs font-mono hover:border-primary/40 hover:bg-base-100 transition-colors"
										>
											{t.token}
										</button>
									))}
								</div>
								<p className="text-xs text-base-content/50 mt-2">
									Değeri olmayan satırlar mesaja eklenmez. Müşteri adı ve tapu
									bilgileri hiçbir şekilde paylaşılmaz.
								</p>
							</div>

							<div>
								<p className="text-sm font-medium mb-1.5">Önizleme</p>
								<pre className="rounded-xl bg-base-200 border border-base-300 p-3 text-sm whitespace-pre-wrap break-words font-sans">
									{preview}
								</pre>
							</div>

							<div className="flex flex-wrap gap-2">
								<Button onClick={save} disabled={busy || !dirty}>
									{busy ? "Kaydediliyor…" : "Kaydet"}
								</Button>
								{isCustom && (
									<Button variant="outline" onClick={() => setConfirmReset(true)} disabled={busy}>
										<RotateCcw className="w-4 h-4" />
										Varsayılana dön
									</Button>
								)}
							</div>
						</>
					)}
				</div>
			)}

			<ConfirmDialog
				open={confirmReset}
				title="Varsayılan şablona dönülsün mü?"
				message="Özelleştirdiğiniz metin silinecek ve yerleşik varsayılan kullanılacak."
				confirmLabel="Varsayılana dön"
				loading={busy}
				onConfirm={reset}
				onCancel={() => setConfirmReset(false)}
			/>
		</Card>
	);
}
