import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { LearnShelfClient } from "@/components/platform/cabinet/LearnShelfClient";
import { PERSONAL_ORIGIN } from "@/lib/surfaces/catalog";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Навчання",
    description: describe("Ваші курси на CenterWay: уроки, поступ і наступний крок у кожній програмі.", {
      bounded: false,
    }),
    noindex: true,
  }),
  /* The dashboard's canonical is the personal host's ROOT. `metadataBase` is
     the public origin, so a relative value here would have published
     `www/learn` — an address that now 404s — as the canonical form of a page
     that is not on `www` at all. */
  alternates: { canonical: PERSONAL_ORIGIN },
};

export default function LearnShelfPage() {
  return (
    <PlatformShell headerMode="learn" surface="personal" footer={false}>
      <LearnShelfClient />
    </PlatformShell>
  );
}
