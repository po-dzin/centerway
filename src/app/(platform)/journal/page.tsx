import type { Metadata } from "next";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { JournalClient } from "@/components/platform/cabinet/JournalClient";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Мій журнал",
  description: describe("Ваші позначки й нотатки з усіх курсів CenterWay, у порядку часу.", {
    bounded: false,
  }),
  // One person's own writing. Private in the strongest sense this codebase has
  // — `lms_annotations` has no staff read policy at all — so a crawler must
  // find a sign-in wall here, exactly as it does on the shelf and the player.
  noindex: true,
});

export default function JournalPage() {
  return (
    <PlatformShell
      headerMode="learn"
      surface="personal"
      footer={false}
      /* Beside the library rather than inside it: the journal is written FROM
         courses, so the way back leads to the materials it was written about. */
      back={{ href: LEARNING_SHELF_HREF, label: "До моїх матеріалів" }}
    >
      <JournalClient />
    </PlatformShell>
  );
}
