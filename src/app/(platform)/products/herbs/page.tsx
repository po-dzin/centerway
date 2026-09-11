import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailPage } from "@/components/platform/ProductDetailPage";
import { programPageBySlug } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Трав'яна підтримка",
  description: describe(
    "Трав'яний збір CenterWay: індивідуальний підбір за станом і ритмом, як він поєднується з харчуванням і програмами і коли його не варто починати.",
  ),
  path: "/products/herbs",
});

export default function HerbsProductPage() {
  /* `programPageBySlug` is built from a list, so the compiler cannot see that
     `herbs` is in it. If that entry is ever dropped from `content.ts` this page
     is a 404 rather than a crash on a blank product. */
  const product = programPageBySlug.herbs;
  if (!product) notFound();
  return <ProductDetailPage product={product} />;
}
