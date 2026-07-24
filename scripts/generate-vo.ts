/**
 * Generates the promo voice-over via ElevenLabs → promo/audio/<clip>.mp3.
 *
 *   npm run promo:vo                  # generate every clip
 *   npm run promo:voices              # list voices on the account
 *   npx tsx --env-file=.env.local scripts/generate-vo.ts --voice <id>
 *
 * The lines and their frames live in promo/clips.ts, shared with the
 * composition. promo/script.md is the human-readable version for a voice actor.
 */

import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { CLIPS } from "../promo/clips";

const API = "https://api.elevenlabs.io/v1";

/**
 * George — "warm, captivating storyteller", middle-aged British, tagged for
 * narration.
 *
 * Chosen because it is one of the few voices this account can actually reach:
 * free plans cannot use Voice Library voices via the API (Adam Stone, Rachel
 * and most of `promo:voices` fail with paid_plan_required). Adding a library
 * voice to your VoiceLab in the UI makes it API-usable — do that and switch
 * this id if you want a different read.
 */
const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";

function apiKey(): string {
	const key = process.env.ELEVENLABS_API_KEY;
	if (!key) {
		console.error(
			"ELEVENLABS_API_KEY is not set.\n\n" +
				"Add it to .env.local (already gitignored):\n" +
				"  ELEVENLABS_API_KEY=your_key_here\n\n" +
				"then run:  npm run promo:vo",
		);
		process.exit(1);
	}
	return key;
}

async function listVoices() {
	const res = await fetch(`${API}/voices`, {
		headers: { "xi-api-key": apiKey() },
	});
	if (!res.ok) {
		console.error(`Failed to list voices: ${res.status} ${await res.text()}`);
		process.exit(1);
	}
	const { voices } = (await res.json()) as {
		voices: { voice_id: string; name: string; labels?: Record<string, string> }[];
	};
	for (const v of voices) {
		const desc = Object.values(v.labels ?? {}).join(", ");
		console.log(`${v.voice_id}  ${v.name.padEnd(16)} ${desc}`);
	}
}

async function generateClip(voiceId: string, text: string): Promise<Buffer> {
	const res = await fetch(`${API}/text-to-speech/${voiceId}`, {
		method: "POST",
		headers: {
			"xi-api-key": apiKey(),
			"Content-Type": "application/json",
			Accept: "audio/mpeg",
		},
		body: JSON.stringify({
			text,
			// Multilingual v2 handles "Kagu" and the Turkish-adjacent brand name
			// more gracefully than the English-only model.
			model_id: "eleven_multilingual_v2",
			voice_settings: {
				// Higher stability = steadier, less theatrical. This is a product
				// promo, not an audiobook.
				stability: 0.5,
				similarity_boost: 0.75,
				// A little style, but not so much that it starts emoting.
				style: 0.15,
				use_speaker_boost: true,
			},
		}),
	});

	if (!res.ok) {
		const body = await res.text();
		console.error(`ElevenLabs returned ${res.status}:\n${body}`);

		// 401 covers both a bad key and an exhausted quota, so read the body
		// rather than assuming — they need completely different fixes.
		if (body.includes("quota_exceeded")) {
			console.error(
				"\n→ The key's credit limit is too low for this script (~229 credits).\n" +
					"  ElevenLabs → API Keys → edit the key → raise its credit limit.",
			);
		} else if (res.status === 401) {
			console.error("\n→ The API key looks wrong or expired.");
		}
		if (body.includes("paid_plan_required")) {
			console.error(
				"\n→ Free accounts cannot use library voices via the API.\n" +
					"  Use a voice you created/cloned, or upgrade the plan.",
			);
		}
		process.exit(1);
	}

	return Buffer.from(await res.arrayBuffer());
}

async function generate(voiceId: string) {
	const outDir = resolve("promo/audio");
	mkdirSync(outDir, { recursive: true });

	// Sequential rather than parallel: ElevenLabs rate-limits concurrent
	// requests on free plans, and eight clips is quick either way.
	for (const clip of CLIPS) {
		const audio = await generateClip(voiceId, clip.text);
		const file = resolve(outDir, `${clip.name}.mp3`);
		writeFileSync(file, audio);
		console.log(`  ${clip.name}.mp3  f${clip.frame}  "${clip.text}"`);
	}

	// The old single-take file would otherwise play over the top of the clips.
	rmSync(resolve(outDir, "vo.mp3"), { force: true });

	console.log(`\nWrote ${CLIPS.length} clips to ${outDir}`);
	console.log("Remotion picks these up automatically — re-render to hear them.");
}

const args = process.argv.slice(2);
if (args.includes("--list")) {
	listVoices();
} else {
	const i = args.indexOf("--voice");
	generate(i !== -1 ? args[i + 1] : DEFAULT_VOICE);
}
