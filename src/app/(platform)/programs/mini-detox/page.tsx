import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Legacy alias: the product was called "mini-detox" before it became Reset Day.
 *
 * Kept as a redirect rather than deleted — the URL is old enough to be indexed
 * and linked from outside. It now lands on the platform page instead of being
 * bounced straight to the funnel host, so a buyer arriving through the old
 * name reaches a surface that can tell them they already own the course.
 */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Розвантажувальний день: практикум на 1 день",
    description: describe(
      "Один розвантажувальний день як три дні уваги: підготовка, сам день простого харчування і коректний вихід із поясненням сигналів тіла."
    ),
  }),
  // A legacy address, kept alive for old links. The canonical is the page that
  // actually owns this offer — this route must never compete with it.
  alternates: { canonical: "/programs/reset-day" },
};

export default function MiniDetoxProgramPage() {
  permanentRedirect("/programs/reset-day");
}
