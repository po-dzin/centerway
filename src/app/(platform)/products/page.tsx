import type { Metadata } from "next";
import { PlatformProductsIndexPage } from "@/components/platform/PlatformCatalogPages";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/StructuredData";
import { breadcrumbLd, graph, itemListLd } from "@/lib/seo/jsonLd";
import { platformProductOffers } from "@/lib/platform/content";

export const metadata: Metadata = pageMetadata({
  title: "Продукти і природна підтримка",
  description: describe(
    "Трав'яна та природна підтримка CenterWay: що це, кому доречно і як обирається за станом, ритмом та етапом відновлення, а не за списком симптомів."
  ),
  path: "/products",
});

export default function ProductsIndexPage() {
  return (
    <>
      <JsonLd
        data={graph(
          itemListLd({
            path: "/products",
            name: "Продукти CenterWay",
            items: platformProductOffers.map((product) => ({
              path: `/products/${product.slug}`,
              name: product.fullTitle,
            })),
          }),
          breadcrumbLd([
            { path: "/", name: "CenterWay" },
            { path: "/products", name: "Продукти" },
          ])
        )}
      />
      <PlatformProductsIndexPage />
    </>
  );
}
