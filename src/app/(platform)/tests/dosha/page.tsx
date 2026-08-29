import { PlatformDoshaTestPage } from "@/components/platform/PlatformStandalonePages";
import type { Metadata } from "next";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Тест доші: безкоштовно, 12 питань",
  description: describe(
    "Безкоштовний тест доші CenterWay: 12 питань про сон, травлення, енергію і реакцію на стрес — і зрозумілий перший крок за результатом."
  ),
  path: "/tests/dosha",
});

export default function DoshaTestPage() {
  return <PlatformDoshaTestPage />;
}
