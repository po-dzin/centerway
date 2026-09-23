import { PlatformDoshaTestPage } from "@/components/platform/PlatformStandalonePages";
import type { Metadata } from "next";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";
import { getTestAuthor } from "@/lib/lms/authors";
import { DOSHA_TEST_API_SLUG } from "@/lib/platform/tests";

export const metadata: Metadata = pageMetadata({
  title: "Тест доші: безкоштовно, 12 питань",
  description: describe(
    "Безкоштовний тест доші CenterWay: 12 питань про сон, травлення, енергію і реакцію на стрес — і зрозумілий перший крок за результатом.",
  ),
  path: "/tests/dosha",
});

/* A test is authored material, so the page prints a byline the same way a
   programme page does — read here, on the server, and handed down as data. */
export default async function DoshaTestPage() {
  const author = await getTestAuthor(DOSHA_TEST_API_SLUG);
  return <PlatformDoshaTestPage author={author} />;
}
