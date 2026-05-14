import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Mini Detox - CenterWay",
  description: "Платформена сторінка Mini Detox: короткий 3-денний вхід у ритм, харчування і спостереження за сигналами тіла.",
  alternates: { canonical: "/programs/mini-detox" },
};

export default function MiniDetoxProgramPage() {
  return <ProgramDetailPage program={programPageBySlug["mini-detox"]} />;
}
