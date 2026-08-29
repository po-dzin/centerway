import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Legacy alias: the programme was called "ideal-body" until 2026-08-29.
 *
 * Kept as a redirect rather than deleted, on the same reasoning as
 * `/programs/mini-detox` — the URL is indexed, linked from outside and printed
 * in the sitemap for months. `noindex` so a crawler is told once and then stops
 * spending a fetch rediscovering the move.
 */
export const metadata: Metadata = pageMetadata({
  title: "Природнє тіло з Аюрведою",
  description: describe(
    "Стара адреса програми. Актуальна сторінка — «Природнє тіло з Аюрведою» на /programs/natural-body."
  ),
  noindex: true,
});

export default function IdealBodyProgramPage() {
  permanentRedirect("/programs/natural-body");
}
