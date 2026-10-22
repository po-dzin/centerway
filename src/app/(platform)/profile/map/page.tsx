import type { Metadata } from "next";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { SphereMapClient } from "@/components/platform/cabinet/SphereMapClient";
import { describe } from "@/lib/brand/identity";
import { PROFILE_HREF } from "@/lib/platform/content";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Карта сфер",
  description: describe("Ваша карта семи сфер життя: де ви зараз і куди хочете через рік.", {
    bounded: false,
  }),
  // One person's own assessment of their life, private to its owner — the
  // table has no policy for anybody else — so a crawler finds a sign-in wall.
  noindex: true,
});

export default function SphereMapPage() {
  return (
    <PlatformShell
      headerMode="learn"
      surface="personal"
      footer={false}
      /* The way back leads to the profile: the map is one of the things the
         profile holds, the way the journal is one of the library's. */
      back={{ href: PROFILE_HREF, label: "До профілю", text: "Профіль" }}
    >
      <SphereMapClient />
    </PlatformShell>
  );
}
