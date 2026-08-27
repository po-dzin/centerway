import type { Metadata } from "next";
import { PlatformProgramsIndexPage } from "@/components/platform/PlatformCatalogPages";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/StructuredData";
import { breadcrumbLd, graph, itemListLd } from "@/lib/seo/jsonLd";
import { programs } from "@/lib/platform/content";

export const metadata: Metadata = pageMetadata({
  title: "Програми і курси",
  description: describe(
    "Усі програми CenterWay: детокс «Шлях 21», розвантажувальний день, гімнастика IREM, харчування під конституцію — з уроками, практикою і зрозумілим форматом."
  ),
  path: "/programs",
});

export default function ProgramsIndexPage() {
  return (
    <>
      {/* The catalogue as a list, so "які програми є у CenterWay" has one node
          to answer from instead of six pages that each mention themselves. */}
      <JsonLd
        data={graph(
          itemListLd({
            path: "/programs",
            name: "Програми і курси CenterWay",
            items: programs
              .filter((program) => program.surfaceType !== "product")
              .map((program) => ({ path: `/programs/${program.slug}`, name: program.fullTitle })),
          }),
          breadcrumbLd([
            { path: "/", name: "CenterWay" },
            { path: "/programs", name: "Програми" },
          ])
        )}
      />
      <PlatformProgramsIndexPage />
    </>
  );
}
