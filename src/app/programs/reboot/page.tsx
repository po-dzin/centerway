import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Short Reboot - CenterWay",
  description: "Платформена сторінка Short Reboot: короткий тілесний вхід, рух, увага і м'яке повернення енергії.",
  alternates: { canonical: "/programs/reboot" },
};

export default function RebootProgramPage() {
  return <ProgramDetailPage program={programPageBySlug.reboot} />;
}

