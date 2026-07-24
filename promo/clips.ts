/**
 * The narration, split into clips placed independently on the timeline.
 *
 * Generating the script as one take does not work: TTS collapses the written
 * gaps to ~0.5s, so the whole 30s read lands in 16s and finishes long before
 * the video does. Each clip is rendered separately (scripts/generate-vo.ts) and
 * pinned to its own frame (promo/Narration.tsx) — that is what keeps the line
 * on the picture it belongs to.
 *
 * `frame` values are 30fps and mirror promo/script.md. The first three sit a
 * few frames before their anvil impacts (37 / 112 / 187) so the word lands with
 * the hit rather than after it.
 *
 * Shared by the generator and the composition, so the two cannot drift.
 */

export interface Clip {
	/** Output filename stem — promo/audio/<name>.mp3 */
	name: string;
	/** Frame the line starts on, at 30fps. */
	frame: number;
	text: string;
}

export const CLIPS: Clip[] = [
	{ name: "01-leads", frame: 30, text: "Scattered leads." },
	{ name: "02-contracts", frame: 105, text: "Lost contracts." },
	{ name: "03-paperwork", frame: 180, text: "Paperwork piling up." },
	{ name: "04-better", frame: 312, text: "There's a better way." },
	{ name: "05-property", frame: 375, text: "Every property, in one place." },
	{ name: "06-leads", frame: 495, text: "Every lead, captured the moment it lands." },
	{ name: "07-contracts", frame: 645, text: "Contracts, done in a click." },
	// 4.2s long — the longest clip. Starts at 765 so it ends ~f890, inside the
	// 900-frame video; at 780 the last words were cut off by the end of the file.
	{ name: "08-brand", frame: 765, text: "Kagu Real Estate dot com. Real estate, simplified." },
];
