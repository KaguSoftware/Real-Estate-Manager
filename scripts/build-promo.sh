#!/usr/bin/env bash
#
# Builds the finished promo: voice-over, then both video formats.
#
#   npm run promo:build          # generate VO if missing, render both
#   npm run promo:build -- --vo  # force-regenerate the VO first
#
# The VO is only generated when promo/audio/vo.mp3 is absent, because every run
# costs ElevenLabs quota. Pass --vo after changing the script or the voice.

set -euo pipefail

cd "$(dirname "$0")/.."

VO_FILE="promo/audio/vo.mp3"
FORCE_VO=false
[[ "${1:-}" == "--vo" ]] && FORCE_VO=true

echo "==> Typechecking"
npx tsc --noEmit -p tsconfig.json

if [[ "$FORCE_VO" == true || ! -f "$VO_FILE" ]]; then
	if [[ -z "${ELEVENLABS_API_KEY:-}" ]] && ! grep -q "^ELEVENLABS_API_KEY=" .env.local 2>/dev/null; then
		# Not fatal: Narration.tsx renders silent when the file is absent, so a
		# missing key should still produce a usable (silent) video.
		echo "==> No ELEVENLABS_API_KEY found — skipping VO, rendering silent."
		echo "    Add it to .env.local and re-run to add narration."
	else
		echo "==> Generating voice-over"
		# A VO failure (quota, bad key) must not sink the whole build — the
		# render still produces a usable silent video, which is the more useful
		# outcome than no video at all.
		npm run --silent promo:vo || echo "==> VO failed — continuing, video will be silent."
	fi
else
	echo "==> Using existing $VO_FILE (pass --vo to regenerate)"
fi

echo "==> Rendering 16:9  → out/promo.mp4"
npx remotion render promo/index.ts Promo out/promo.mp4

echo "==> Rendering 9:16  → out/promo-vertical.mp4"
npx remotion render promo/index.ts PromoVertical out/promo-vertical.mp4

echo
echo "Done:"
ls -lh out/promo.mp4 out/promo-vertical.mp4 | awk '{print "  " $9 "  " $5}'
