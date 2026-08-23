import { PlatformTestsHubPage } from "@/components/platform/PlatformCatalogPages";
import type { Metadata } from "next";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Діагностика і тести",
  description: describe(
    "Самодіагностика CenterWay: тест доші та інші кроки, щоб зрозуміти свій стан, конституцію і з чого доречно почати відновлення."
  ),
  path: "/tests",
});

export default function TestsHubPage() {
  return <PlatformTestsHubPage />;
}
