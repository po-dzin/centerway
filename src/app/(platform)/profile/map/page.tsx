import type { Metadata } from "next";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { CabinetClient } from "@/components/platform/cabinet/CabinetClient";
import { describe } from "@/lib/brand/identity";
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

/**
 * The profile, opened on its «Карта» tab (G 23.10). The map is not a page of
 * its own any more: this address is the profile with the map tab open, under
 * the same room, so a shared link or a reload lands where the person was.
 */
export default function SphereMapPage() {
  return (
    <PlatformShell headerMode="overlay" surface="personal">
      <CabinetClient initialTab="map" />
    </PlatformShell>
  );
}
