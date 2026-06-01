import type { Metadata } from "next";
import { PlatformExpertPage } from "@/components/platform/PlatformStandalonePages";

export const metadata: Metadata = {
  title: "Євгеній Корякін - про автора CenterWay",
  description:
    "Біографія, освіта і практичний шлях Євгенія Корякіна: аюрведа, дієтологія, детоксикація, йога і комплементарна медицина.",
  alternates: { canonical: "/expert" },
};

export default function ExpertPage() {
  return <PlatformExpertPage />;
}
