import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

/**
 * WHY A TEST GUARDS A CONFIG FIELD. `next/image` answers an unlisted remote
 * host with a 400 and no fallback, so the failure is invisible to every gate
 * this repo runs — it type-checks, it builds, the page renders, and the only
 * symptom is a broken picture on a surface whose author happens to have
 * uploaded their own photo. It was live in that state, and nothing caught it.
 */
describe("next/image remote hosts", () => {
  it("permits the storage host an author's own upload is served from", () => {
    const patterns = nextConfig.images?.remotePatterns ?? [];
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabase) {
      // No env here means the config cannot name a host; that is the documented
      // empty case, not a pass to be silent about.
      expect(patterns).toEqual([]);
      return;
    }
    const host = new URL(supabase).hostname;
    const match = patterns.find((pattern) => typeof pattern === "object" && pattern.hostname === host);
    expect(match, `no remotePattern for ${host}`).toBeTruthy();
    // Public objects only — the permission is "serve what the bucket already
    // serves to anyone", not the whole API surface of the project.
    expect((match as { pathname?: string }).pathname).toBe("/storage/v1/object/public/**");
  });
});
