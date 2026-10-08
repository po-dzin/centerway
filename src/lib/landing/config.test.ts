import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getLandingShellAssets } from "./config";

describe("managed landing script delivery", () => {
  for (const product of ["short", "irem"] as const) {
    it(`${product}: every configured script exists in the static asset store`, () => {
      const assets = getLandingShellAssets(product);
      for (const src of [...assets.scripts, assets.pixelScript, assets.runtimeScript]) {
        if (!src) throw new Error(`${product}: missing configured script`);
        expect(existsSync(path.join(process.cwd(), "src/landing-static", src.slice(1))), src).toBe(true);
      }
    });
  }
});
