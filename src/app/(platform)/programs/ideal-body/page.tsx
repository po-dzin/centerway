import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Ідеальне тіло з Аюрведою: 8 тижнів харчування",
  description: describe(
    "8-тижнева програма харчування і тілесної стабілізації: вага, апетит, травлення і раціон під вашу конституцію, без дієтичних крайнощів."
  ),
  path: "/programs/ideal-body",
});

export default function IdealBodyPage() {
  return <ProgramDetailPage program={programPageBySlug["ideal-body"]} />;
}
