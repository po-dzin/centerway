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

describe("landing shell scripts", () => {
  it("loads the pre-payment email step before the checkout binder on every Next-rendered landing", async () => {
    for (const product of ["short", "irem"] as const) {
      const { scripts } = getLandingShellAssets(product);
      const gate = scripts.indexOf("/shared/js/email-gate.js");
      expect(gate).toBeGreaterThanOrEqual(0);
      expect(gate).toBeLessThan(scripts.indexOf("/shared/js/funnel-common.js"));
    }
  });
});
