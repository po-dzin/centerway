import { PlatformConsultPage } from "@/components/platform/PlatformStandalonePages";
import type { Metadata } from "next";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/StructuredData";
import { breadcrumbLd, graph, personLd, serviceLd } from "@/lib/seo/jsonLd";
import { BRAND } from "@/lib/brand/identity";

export const metadata: Metadata = pageMetadata({
  title: "Аюрведична консультація",
  description: describe(
    "Персональна консультація з Євгенієм Корякіним: онлайн до 90 хвилин, аюрведичний профіль, харчування, режим і план на 2-4 тижні. Освіта, практика і підхід автора."
  ),
  path: "/consult",
});

export default function ConsultPage() {
  return (
    <>
      {/* A Service, not a Course: nothing is delivered as lessons, and no price
          is published — the consultation is agreed in conversation. */}
      <JsonLd
        data={graph(
          serviceLd({
            path: "/consult",
            name: "Аюрведична консультація з Євгенієм Корякіним",
            description:
              "Персональна онлайн-консультація до 90 хвилин: аюрведичний профіль, харчування, режим дня, відновлення і план на 2-4 тижні.",
          }),
          /* Inherited from `/expert` when the two pages merged on 2026-08-23.
             The Person node itself is in the layout's graph on every page; this
             says the page is ABOUT that person, which is what made `/expert` the
             address an answer engine cited for "хто такий Євгеній Корякін". The
             claim has to move with the content or that citation is lost to a
             redirect. */
          {
            "@type": "ProfilePage",
            name: `${BRAND.founder.name} — консультація і про автора`,
            mainEntity: personLd(),
          },
          breadcrumbLd([
            { path: "/", name: "CenterWay" },
            { path: "/consult", name: "Консультація" },
          ])
        )}
      />
      <PlatformConsultPage />
    </>
  );
}
