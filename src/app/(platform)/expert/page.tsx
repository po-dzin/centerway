import { permanentRedirect } from "next/navigation";

/**
 * Merged into `/consult` on 2026-08-23.
 *
 * The two pages answered one question between them — who runs this, and how do
 * I work with him — and split it so that each half had to sell the other. The
 * consultation is the surface that survives, because it is the one someone
 * arrives wanting; the author's credentials and path are now the evidence on
 * it rather than a destination of their own.
 *
 * A permanent redirect rather than a deletion: this path is in the sitemap that
 * has already been crawled, it is linked from the static landings' `#expert`
 * anchors, and `platformEscape`/`requestBrand` route on it. 308 keeps every one
 * of those working and hands the ranking to `/consult`.
 */
export default function ExpertPage() {
  permanentRedirect("/consult");
}
