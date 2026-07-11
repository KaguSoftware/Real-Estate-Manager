"use client";

import { humanizeError } from "@/src/lib/errors";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import {
	listPropertyImages,
	uploadPropertyImage,
	deletePropertyImage,
} from "@/src/lib/db/propertyImages";
import { invalidateCache } from "@/src/lib/useCachedResource";
import type { PropertyImage } from "@/src/lib/db/types";
import { Alert, ConfirmDialog, Spinner, toast } from "@/src/components/ui";

interface Props {
	propertyId: string;
	canEdit?: boolean;
}

export function PropertyGallery({ propertyId, canEdit = true }: Props) {
	const [images, setImages] = useState<PropertyImage[]>([]);
	const [featuredIdx, setFeaturedIdx] = useState(0);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		let cancelled = false;
		// Async flag flip (not synchronous setState in the effect body) — same
		// pattern as useCachedResource.
		queueMicrotask(() => { if (!cancelled) setLoading(true); });
		listPropertyImages(propertyId)
			.then((rows) => { if (!cancelled) { setImages(rows); setFeaturedIdx(0); } })
			.catch((e: unknown) => { if (!cancelled) setError(humanizeError(e)); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [propertyId]);

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		setUploading(true);
		setError(null);

		const queue = Array.from(files);
		for (const f of queue) {
			try {
				const compressed = await imageCompression(f, {
					maxSizeMB: 1,
					maxWidthOrHeight: 2000,
					useWebWorker: true,
				});
				// browser-image-compression returns a Blob in some paths; ensure File.
				const asFile = compressed instanceof File
					? compressed
					: new File([compressed], f.name, { type: f.type });
				const row = await uploadPropertyImage(propertyId, asFile);
				setImages((prev) => [...prev, row]);
			} catch (e) {
				setError(humanizeError(e));
				break;
			}
		}

		setUploading(false);
		invalidateCache("properties:covers");
		if (fileRef.current) fileRef.current.value = "";
	}

	const [deleting, setDeleting] = useState<PropertyImage | null>(null);
	const [deleteBusy, setDeleteBusy] = useState(false);

	async function handleDelete() {
		if (!deleting) return;
		setDeleteBusy(true);
		try {
			await deletePropertyImage(deleting);
			const next = images.filter((p) => p.id !== deleting.id);
			setImages(next);
			// Keep the featured index in range.
			setFeaturedIdx((idx) => Math.max(0, Math.min(idx, next.length - 1)));
			invalidateCache("properties:covers");
			toast.success("Fotoğraf silindi.");
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setDeleting(null);
			setDeleteBusy(false);
		}
	}

	const featured = images[featuredIdx] ?? null;
	const hasImages = images.length > 0;

	return (
		<section className="mb-6">
			<input
				ref={fileRef}
				type="file"
				accept="image/*"
				multiple
				className="hidden"
				onChange={(e) => handleFiles(e.target.files)}
			/>

			{/* Hero */}
			<div className="relative w-full aspect-[4/3] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-base-200 border border-base-300">
				{loading ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<Spinner />
					</div>
				) : featured ? (
					<Image
						src={featured.url}
						alt="Taşınmaz fotoğrafı"
						fill
						sizes="(max-width: 768px) 100vw, 960px"
						className="object-cover"
						priority
					/>
				) : (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
						<svg className="w-10 h-10 text-base-content/30 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
							<rect x="3" y="3" width="18" height="18" rx="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="M21 15l-5-5L5 21" />
						</svg>
						<p className="text-xs text-base-content/60 mb-3">Henüz fotoğraf yok.</p>
						{canEdit && (
							<button
								type="button"
								onClick={() => fileRef.current?.click()}
								disabled={uploading}
								className="inline-flex items-center h-11 px-4 text-sm font-semibold rounded-xl bg-primary text-primary-content hover:brightness-110 transition-all shadow-soft disabled:opacity-50"
							>
								{uploading ? "Yükleniyor…" : "+ Fotoğraf ekle"}
							</button>
						)}
					</div>
				)}
			</div>

			{error && <Alert className="mt-2">{error}</Alert>}

			{/* Thumbnail strip + uploader */}
			{(hasImages || canEdit) && (
				<div className="mt-3 flex items-center gap-2 overflow-x-auto sm:flex-wrap snap-x snap-mandatory pb-1">
					{images.map((img, i) => (
						<div
							key={img.id}
							className={`relative shrink-0 snap-start w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border-2 group cursor-pointer transition-all ${
								i === featuredIdx
									? "border-primary ring-2 ring-primary/30"
									: "border-base-300 hover:border-base-content/40"
							}`}
							onClick={() => setFeaturedIdx(i)}
						>
							<Image
								src={img.url}
								alt="Küçük görsel"
								fill
								sizes="96px"
								className="object-cover"
							/>
							{canEdit && (
								<button
									type="button"
									onClick={(e) => { e.stopPropagation(); setDeleting(img); }}
									className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white text-base leading-none flex items-center justify-center hover:bg-error transition-colors"
									aria-label="Fotoğrafı sil"
								>×</button>
							)}
						</div>
					))}

					{canEdit && hasImages && (
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							disabled={uploading}
							className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg border-2 border-dashed border-base-300 hover:border-primary hover:bg-primary/5 flex items-center justify-center text-base-content/50 hover:text-primary transition-all disabled:opacity-50"
							aria-label="Daha fazla fotoğraf ekle"
						>
							<span className="text-2xl">{uploading ? "…" : "+"}</span>
						</button>
					)}
				</div>
			)}

			<ConfirmDialog
				open={deleting !== null}
				title="Bu fotoğraf silinsin mi?"
				message="Fotoğraf depolamadan kalıcı olarak kaldırılır."
				confirmLabel="Sil"
				loading={deleteBusy}
				onConfirm={handleDelete}
				onCancel={() => setDeleting(null)}
			/>
		</section>
	);
}
