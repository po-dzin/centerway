import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Розвантажувальний день: практикум на 1 день",
  description: describe(
    "Один розвантажувальний день як три дні уваги: підготовка, сам день простого харчування і коректний вихід із поясненням сигналів тіла."
  ),
  path: "/programs/reset-day",
});

export default function ResetDayProgramPage() {
  return <ProgramDetailPage program={programPageBySlug["reset-day"]} />;
}
