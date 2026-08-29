import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { CabinetClient } from "@/components/platform/cabinet/CabinetClient";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Мій кабінет",
  description: describe(
    "Кабінет CenterWay: куплені програми і продукти, результати тестів, контактні дані та вхід у навчання.",
    { bounded: false }
  ),
  // One person's own page. It needs a session to say anything, so a crawler
  // finds a sign-in wall — the same rule the shelf and the player follow.
  noindex: true,
});

export default function PlatformProfilePage() {
  return (
    <PlatformShell headerMode="overlay">
      <CabinetClient />
    </PlatformShell>
  );
}
