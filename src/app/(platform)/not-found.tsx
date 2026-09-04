import { PlatformShell } from "@/components/platform/PlatformLayout";
import { PlatformNotFoundPanel } from "@/components/platform/PlatformNotFound";

/**
 * 404 for a route that exists — `notFound()` from /learn, /expert, /programs.
 *
 * WHAT IT REPLACES. Nothing was written here, so every one of those fell to
 * Next's built-in page, which ships its own inline stylesheet and no shell:
 * one line of Helvetica, full bleed, and no way out but the back gesture. It
 * is also the one surface in the product that could not be themed — see
 * `src/app/global-not-found.tsx` for the other half of this.
 *
 * IT LIVES IN THE ROUTE GROUP, not at `src/app/`. This app has no root layout;
 * each route group is its own root, so a `not-found` at `src/app/` would have
 * no <html> to render into. Here it is inside the public root layout, which is
 * what hands it the theme boot script, the token sheet and the shell.
 */
/* NO `metadata` EXPORT HERE, and not by omission: `not-found` is not a page,
   so Next ignores one — the tab keeps the layout's default title. The title
   for an address that matched nothing is set in `global-not-found.tsx`, which
   IS allowed one. The 404 status code is what a crawler actually reads. */

export default function PlatformNotFound() {
  return (
    /* `default`, not `overlay`: overlay is for a page that opens on a dark hero
       and lets the bar float over it. This one opens on the canvas. */
    <PlatformShell headerMode="default">
      <main data-cw-platform-template="not-found">
        <PlatformNotFoundPanel />
      </main>
    </PlatformShell>
  );
}
