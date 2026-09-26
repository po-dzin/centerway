import { PlatformBalanceTestPage } from "@/components/platform/PlatformStandalonePages";
import type { Metadata } from "next";
import { describe } from "@/lib/brand/identity";
import { getTestAuthor } from "@/lib/lms/authors";
import { BALANCE_TEST_API_SLUG, BALANCE_TEST_ROUTE } from "@/lib/platform/tests";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Тест балансу дош: безкоштовно, 9 питань",
  description: describe(
    "Безкоштовний тест CenterWay про поточний стан: яка доша зараз вийшла з рівноваги — вата, пітта чи капха — і що з цим робити в режимі, їжі та диханні.",
  ),
  path: BALANCE_TEST_ROUTE,
});

/* Authored like the dosha test: the byline is read here, on the server, from
   the test's row in `test_definitions`, and prints nothing until one exists. */
export default async function BalanceTestPage() {
  const author = await getTestAuthor(BALANCE_TEST_API_SLUG);
  return <PlatformBalanceTestPage author={author} />;
}
