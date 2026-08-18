import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

/**
 * Legacy alias: the product was called "mini-detox" before it became Reset Day.
 *
 * Kept as a redirect rather than deleted — the URL is old enough to be indexed
 * and linked from outside. It now lands on the platform page instead of being
 * bounced straight to the funnel host, so a buyer arriving through the old
 * name reaches a surface that can tell them they already own the course.
 */
export const metadata: Metadata = {
  title: "Reset Day - CenterWay",
  description: "Legacy alias route for the Reset Day platform page.",
  alternates: { canonical: "/programs/reset-day" },
};

export default function MiniDetoxProgramPage() {
  permanentRedirect("/programs/reset-day");
}
