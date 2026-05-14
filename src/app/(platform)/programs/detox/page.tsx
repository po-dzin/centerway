import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Detox - CenterWay",
  description: "Платформена сторінка Detox: м'яке очищення, травлення, ритм і 21-денний маршрут без медичних обіцянок.",
  alternates: { canonical: "/programs/detox" },
};

export default function DetoxProgramPage() {
  return <ProgramDetailPage program={programPageBySlug.way21} />;
}
