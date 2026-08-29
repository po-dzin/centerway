import type { Metadata } from "next";
import { ProductDetailPage } from "@/components/platform/ProductDetailPage";
import { programPageBySlug } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Трав'яна підтримка",
  description: describe(
    "Трав'яний збір CenterWay: індивідуальний підбір за станом і ритмом, як він поєднується з харчуванням і програмами і коли його не варто починати."
  ),
  path: "/products/herbs",
});

export default function HerbsProductPage() {
  return <ProductDetailPage product={programPageBySlug.herbs} />;
}
