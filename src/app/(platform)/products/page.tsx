import type { Metadata } from "next";
import { PlatformProductsIndexPage } from "@/components/platform/PlatformCatalogPages";

export const metadata: Metadata = {
  title: "Продукти CenterWay",
  description: "Трав'яна та природна підтримка CenterWay: як обирати продукти в контексті стану, ритму, програм і меж методу.",
  alternates: { canonical: "/products" },
};

export default function ProductsIndexPage() {
  return <PlatformProductsIndexPage />;
}
