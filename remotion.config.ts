/**
 * Remotion config — promo video only. This is separate from the Next.js build;
 * `next build` never touches promo/ and Remotion never touches src/.
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("./promo/index.ts");

// Remotion's staticFile() would otherwise resolve against the Next.js public/
// dir and mix promo assets into the app's served files. Keep them separate.
Config.setPublicDir("./promo/audio");
