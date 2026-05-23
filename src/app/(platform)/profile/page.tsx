import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { UserProfilePageClient } from "@/components/platform/UserProfilePageClient";

export const metadata: Metadata = {
  title: "Мій профіль - CenterWay",
  description: "Персональний профіль користувача CenterWay: доша, покупки, доступи і стан маршруту на платформі.",
  alternates: { canonical: "/profile" },
};

export default function PlatformProfilePage() {
  return (
    <PlatformShell headerMode="overlay">
      <UserProfilePageClient />
    </PlatformShell>
  );
}
