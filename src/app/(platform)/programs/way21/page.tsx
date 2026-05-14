import type { Metadata } from "next";
import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";

export const metadata: Metadata = {
  title: "Way 21 - детокс програма CenterWay",
  description: "Платформена сторінка програми Way 21: м'яке очищення, травлення, ритм і аюрведичний маршрут.",
  alternates: { canonical: "/programs/way21" },
};

export default function Way21Page() {
  return <GeneratedRouteScreen routeKey="program-way21" />;
}
