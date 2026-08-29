import type { Metadata } from "next";
import { PlatformProgramsIndexPage } from "@/components/platform/PlatformCatalogPages";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/StructuredData";
import { breadcrumbLd, graph, itemListLd } from "@/lib/seo/jsonLd";
import { programs } from "@/lib/platform/content";
import { listStorefrontCourses } from "@/lib/platform/offers";

export const metadata: Metadata = pageMetadata({
  title: "Програми і курси",
  description: describe(
    "Усі програми CenterWay: детокс «Шлях 21», розвантажувальний день, гімнастика IREM, харчування під конституцію — з уроками, практикою і зрозумілим форматом."
  ),
  path: "/programs",
});

export default async function ProgramsIndexPage() {
  const staticItems = programs
    .filter((program) => program.surfaceType !== "product")
    .map((program) => ({ path: `/programs/${program.slug}`, name: program.fullTitle }));

  // The rendered page (`PlatformProgramsIndexPage`) already merges authored
  // courses into its two rails — a buyer does not care which of them was typed
  // into a TS file and which came out of the builder. This list has to follow
  // the same merge: `programs` is the six hand-written entries only, and
  // Reset Day moving to a builder-authored row (2026-08-26) dropped it from
  // that array — the visible page still shows it, but the ItemList silently
  // stopped naming it. Deduping by PATH rather than slug is what keeps that
  // from recurring the next time an offer migrates off the static list.
  const known = new Set(staticItems.map((item) => item.path));
  const authored = await listStorefrontCourses();
  const authoredItems = authored
    .map((course) => ({ path: `/programs/${course.slug}`, name: course.title }))
    .filter((item) => !known.has(item.path));

  return (
    <>
      {/* The catalogue as a list, so "які програми є у CenterWay" has one node
          to answer from instead of six pages that each mention themselves. */}
      <JsonLd
        data={graph(
          itemListLd({
            path: "/programs",
            name: "Програми і курси CenterWay",
            items: [...staticItems, ...authoredItems],
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
