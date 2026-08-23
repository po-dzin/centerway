import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Шлях 21: детокс-програма на 21 день",
  description: describe(
    "21-денна аюрведична програма розвантаження: харчування, трави, режим дня і щоденні опори. Уроки відкриваються в кабінеті, темп — ваш."
  ),
  path: "/programs/way21",
});

export default function Way21Page() {
  return <ProgramDetailPage program={programPageBySlug.way21} />;
}
