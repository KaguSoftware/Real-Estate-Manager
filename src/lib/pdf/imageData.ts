/**
 * Fetch an image URL and inline it as a data: URL.
 *
 * @react-pdf/renderer cannot fetch remote images itself in the browser build,
 * so every photo must be embedded as base64 before rendering. That makes the
 * cost real: each inlined photo is stored at up to 1 MB (see PropertyGallery's
 * compression settings), and base64 adds ~33 %. Callers rendering more than one
 * property should inline the cover image only.
 *
 * Returns null instead of throwing — a missing photo degrades the document
 * rather than failing the whole export.
 */
export async function toDataUrl(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const blob = await res.blob();
		return await new Promise((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}
