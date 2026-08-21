import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { LearnShelfClient } from "@/components/platform/cabinet/LearnShelfClient";

export const metadata: Metadata = {
  title: "Навчання - CenterWay",
  description: "Ваші курси на CenterWay: уроки, поступ і наступний крок у кожній програмі.",
  alternates: { canonical: "/learn" },
  // The shelf is one person's, and there is nothing on it for a crawler.
  robots: { index: false, follow: false },
};

export default function LearnShelfPage() {
  return (
    <PlatformShell headerMode="overlay">
      <LearnShelfClient />
    </PlatformShell>
  );
}
