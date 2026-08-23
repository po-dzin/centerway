import type { Metadata } from "next";
import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { programPageBySlug } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Short-Перезавантаження: тілесний міні-курс",
  description: describe(
    "Короткий тілесний вхід у практику: розігрів, дихання, увага і м'яке повернення енергії — для тих, хто починає з нуля і без часу."
  ),
  path: "/programs/reboot",
});

export default function RebootProgramPage() {
  return <ProgramDetailPage program={programPageBySlug.reboot} />;
}
