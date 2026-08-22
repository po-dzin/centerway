import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { LearnShelfClient } from "@/components/platform/cabinet/LearnShelfClient";
import { PERSONAL_ORIGIN } from "@/lib/surfaces/catalog";

export const metadata: Metadata = {
  title: "Навчання - CenterWay",
  description: "Ваші курси на CenterWay: уроки, поступ і наступний крок у кожній програмі.",
  /* The dashboard's canonical is the personal host's ROOT. `metadataBase` is
     the public origin, so a relative value here would have published
     `www/learn` — an address that now 404s — as the canonical form of a page
     that is not on `www` at all. */
  alternates: { canonical: PERSONAL_ORIGIN },
  // The shelf is one person's, and there is nothing on it for a crawler.
  robots: { index: false, follow: false },
};

export default function LearnShelfPage() {
  return (
    <PlatformShell headerMode="overlay">
      <LearnShelfClient />
    </PlatformShell>
  );
}
