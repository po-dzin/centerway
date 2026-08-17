import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Reset Day - CenterWay",
  description:
    "Платформена сторінка Reset Day: один розвантажувальний день як три дні уваги — підготовка, сам день і коректний вихід.",
  alternates: { canonical: "/programs/reset-day" },
};

export default function ResetDayProgramPage() {
  return <ProgramDetailPage program={programPageBySlug["reset-day"]} />;
}
