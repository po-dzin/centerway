import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "IREM Гімнастика - CenterWay",
  description: "Платформена сторінка IREM Гімнастики: рух, тіло, енергія, легкість і робота з м'язовими затискачами.",
  alternates: { canonical: "/programs/irem" },
};

export default function IremPage() {
  return <ProgramDetailPage program={programPageBySlug.irem} />;
}
