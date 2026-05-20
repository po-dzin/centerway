import type { Metadata } from "next";
import { ProductDetailPage } from "@/components/platform/ProductDetailPage";
import { programPageBySlug } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Трав'яна підтримка - CenterWay",
  description: "Трав'яна підтримка CenterWay: коли вона доречна, як поєднується з харчуванням і ритмом та чому її не варто обирати без контексту стану.",
  alternates: { canonical: "/products/herbs" },
};

export default function HerbsProductPage() {
  return <ProductDetailPage product={programPageBySlug.herbs} />;
}
