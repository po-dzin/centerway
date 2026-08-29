import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Природнє тіло з Аюрведою: 21 урок про харчування і ритм",
  description: describe(
    "Навчальна програма з 21 основного уроку про Аюрведу, властивості продуктів, добовий ритм і баланс дош."
  ),
  path: "/programs/natural-body",
});

export default function NaturalBodyPage() {
  return <ProgramDetailPage program={programPageBySlug["natural-body"]} />;
}
