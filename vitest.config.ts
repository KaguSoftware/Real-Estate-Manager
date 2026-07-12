import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	resolve: {
		// Mirror tsconfig's "@/*" → "./*" path alias.
		alias: { "@": path.resolve(__dirname) },
	},
	test: {
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		environment: "node",
	},
});
