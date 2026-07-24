/**
 * Voice-over track.
 *
 * The narration is a set of short clips in promo/audio, each pinned to the
 * frame its line belongs on — not one continuous take. TTS collapses written
 * pauses to about half a second, so a single-file read of this script lands in
 * 16s against a 30s video and drifts badly out of sync with the visuals.
 * Placing each line independently is what keeps "Scattered leads." on the
 * anvil that says Scattered Leads.
 *
 * Generate with `npm run promo:vo`. Until the files exist this renders nothing,
 * so the video always builds — a missing staticFile() throws at render time,
 * and a promo that fails to build because nobody ran the VO step is worse than
 * a silent one.
 */

import React from "react";
import { Audio, Sequence, staticFile, getStaticFiles } from "remotion";
import { CLIPS } from "./clips";

export const Narration: React.FC = () => {
	// Reflects what is actually on disk, so a partial generation renders the
	// clips that exist rather than throwing on the first missing one.
	const present = new Set(getStaticFiles().map((f) => f.name));

	return (
		<>
			{CLIPS.filter((clip) => present.has(`${clip.name}.mp3`)).map((clip) => (
				<Sequence key={clip.name} from={clip.frame}>
					<Audio src={staticFile(`${clip.name}.mp3`)} />
				</Sequence>
			))}
		</>
	);
};
