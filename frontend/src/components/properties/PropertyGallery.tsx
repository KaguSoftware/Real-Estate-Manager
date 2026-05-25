"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import {
	listPropertyImages,
	uploadPropertyImage,
	deletePropertyImage,
} from "@/src/lib/db/propertyImages";
import type { PropertyImage } from "@/src/lib/db/types";

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
		setLoading(true);
		listPropertyImages(propertyId)
			.then((rows) => { if (!cancelled) { setImages(rows); setFeaturedIdx(0); } })
			.catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
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
				setError(e instanceof Error ? e.message : String(e));
				break;
			}
		}

		setUploading(false);
		if (fileRef.current) fileRef.current.value = "";
	}

	async function handleDelete(img: PropertyImage) {
		if (!confirm("Delete this photo?")) return;
		try {
			await deletePropertyImage(img);
			setImages((prev) => {
				const next = prev.filter((p) => p.id !== img.id);
				// Keep the featured index in range.
				setFeaturedIdx((idx) => Math.max(0, Math.min(idx, next.length - 1)));
				return next;
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
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
			<div className="relative w-full aspect-[4/3] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
				{loading ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
					</div>
				) : featured ? (
					<Image
						src={featured.url}
						alt="Property photo"
						fill
						sizes="(max-width: 768px) 100vw, 960px"
						className="object-cover"
						priority
					/>
				) : (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
						<svg className="w-10 h-10 text-slate-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
							<rect x="3" y="3" width="18" height="18" rx="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="M21 15l-5-5L5 21" />
						</svg>
						<p className="text-xs text-slate-500 mb-3">No photos yet.</p>
						{canEdit && (
							<button
								type="button"
								onClick={() => fileRef.current?.click()}
								disabled={uploading}
								className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity disabled:opacity-50"
							>
								{uploading ? "Uploading…" : "+ Add photos"}
							</button>
						)}
					</div>
				)}
			</div>

			{error && (
				<div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700">
					{error}
				</div>
			)}

			{/* Thumbnail strip + uploader */}
			{(hasImages || canEdit) && (
				<div className="mt-3 flex items-center gap-2 overflow-x-auto sm:flex-wrap snap-x snap-mandatory pb-1">
					{images.map((img, i) => (
						<div
							key={img.id}
							className={`relative shrink-0 snap-start w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border-2 group cursor-pointer transition-all ${
								i === featuredIdx
									? "border-primary ring-2 ring-primary/30"
									: "border-slate-200 hover:border-slate-400"
							}`}
							onClick={() => setFeaturedIdx(i)}
						>
							<Image
								src={img.url}
								alt="Thumbnail"
								fill
								sizes="96px"
								className="object-cover"
							/>
							{canEdit && (
								<button
									type="button"
									onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
									className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
									aria-label="Delete photo"
								>×</button>
							)}
						</div>
					))}

					{canEdit && hasImages && (
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							disabled={uploading}
							className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg border-2 border-dashed border-slate-300 hover:border-primary hover:bg-primary/5 flex items-center justify-center text-slate-400 hover:text-primary transition-all disabled:opacity-50"
							aria-label="Add more photos"
						>
							<span className="text-2xl">{uploading ? "…" : "+"}</span>
						</button>
					)}
				</div>
			)}
		</section>
	);
}
