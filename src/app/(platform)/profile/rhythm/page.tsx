import type { Metadata } from "next";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { CabinetClient } from "@/components/platform/cabinet/CabinetClient";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Мій ритм",
  description: describe("Ваші типи дня і кроки з карти сфер, зібрані в день.", { bounded: false }),
  // One person's own day: a crawler finds a sign-in wall.
  noindex: true,
});

/** The profile, opened on «Мій ритм» (G 23.10): the day constructor, under the same room. */
export default function ProfileRhythmPage() {
  return (
    <PlatformShell headerMode="overlay" surface="personal">
      <CabinetClient initialTab="rhythm" />
    </PlatformShell>
  );
}
