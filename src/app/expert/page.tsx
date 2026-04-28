import type { Metadata } from "next";
import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";

export const metadata: Metadata = {
  title: "Євгеній Корякін - про автора CenterWay",
  description:
    "Біографія, освіта і практичний шлях Євгенія Корякіна: аюрведа, дієтологія, детоксикація, йога і комплементарна медицина.",
  alternates: { canonical: "/expert" },
};

export default function ExpertPage() {
  return <GeneratedRouteScreen routeKey="expert" />;
}
