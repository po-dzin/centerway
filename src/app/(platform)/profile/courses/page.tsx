import type { Metadata } from "next";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { CabinetClient } from "@/components/platform/cabinet/CabinetClient";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Мої курси",
  description: describe("Усі ваші курси на платформі CenterWay: де ви зупинились і що далі.", { bounded: false }),
  // One person's own shelf: a crawler finds a sign-in wall.
  noindex: true,
});

/** The profile, opened on its «Курси» tab (G 23.10): every course, under the same room. */
export default function ProfileCoursesPage() {
  return (
    <PlatformShell headerMode="overlay" surface="personal">
      <CabinetClient initialTab="courses" />
    </PlatformShell>
  );
}
