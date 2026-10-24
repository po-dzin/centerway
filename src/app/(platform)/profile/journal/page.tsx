import type { Metadata } from "next";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { CabinetClient } from "@/components/platform/cabinet/CabinetClient";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Мій журнал",
  description: describe("Ваші позначки й нотатки з усіх курсів CenterWay, у порядку часу.", { bounded: false }),
  // One person's own writing: a crawler finds a sign-in wall.
  noindex: true,
});

/** The profile, opened on «Журнал» (G 24.10): the reader's notes, under the same room. */
export default function ProfileJournalPage() {
  return (
    <PlatformShell headerMode="overlay" surface="personal">
      <CabinetClient initialTab="journal" />
    </PlatformShell>
  );
}
