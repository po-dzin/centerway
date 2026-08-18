import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias from tsconfig.json.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    // Unit tests live next to the code they cover.
    // tests/e2e/**.spec.ts belongs to Playwright and must stay out of vitest.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
