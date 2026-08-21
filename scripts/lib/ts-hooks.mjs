/**
 * Lets plain Node scripts import the app's TypeScript directly.
 *
 * Node 22.18+ strips types on its own; what it does not do is resolve the three
 * things this repo's TS relies on and a bundler provides for free —
 * extensionless relative imports (`./course`), the `@/` alias, and bare JSON
 * imports (`import course from "../data/courses/x.json"`, which Node demands an
 * import attribute for). This hook adds exactly those rules and nothing else,
 * so `scripts/*.mjs` can call `src/lib/lms/authoring.ts` instead of keeping a
 * second, drifting copy of the same mapping. No build step, no dependency.
 */

import { pathToFileURL } from "node:url";
import path from "node:path";

const srcDir = pathToFileURL(path.join(process.cwd(), "src") + path.sep).href;
const hasExtension = /\.[mc]?[jt]sx?$|\.json$/;

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    return resolve(srcDir + specifier.slice(2), context, next);
  }

  if (!hasExtension.test(specifier) && (specifier.startsWith(".") || specifier.startsWith("file:"))) {
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return await next(candidate, context);
      } catch {
        // fall through to the next candidate, then to Node's own resolution
      }
    }
  }

  const resolved = await next(specifier, context);

  // Node refuses a JSON module without `with { type: "json" }`; app code is
  // written for the bundler, which needs no such attribute.
  if (resolved.url.endsWith(".json")) {
    return { ...resolved, importAttributes: { ...resolved.importAttributes, type: "json" } };
  }

  return resolved;
}
