import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { CabinetClient } from "@/components/platform/cabinet/CabinetClient";

export const metadata: Metadata = {
  title: "Мій кабінет - CenterWay",
  description:
    "Кабінет користувача CenterWay: навчання і уроки, результати тестів, куплені програми та продукти, контактні дані.",
  alternates: { canonical: "/profile" },
};

export default function PlatformProfilePage() {
  return (
    <PlatformShell headerMode="overlay">
      <CabinetClient />
    </PlatformShell>
  );
}
