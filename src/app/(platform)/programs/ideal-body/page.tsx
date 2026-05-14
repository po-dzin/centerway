import type { Metadata } from "next";
import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";

export const metadata: Metadata = {
  title: "Ідеальне тіло з Аюрведою - CenterWay",
  description: "Платформена сторінка програми Ідеальне тіло: вага, харчова залежність, травлення і раціон під конституцію.",
  alternates: { canonical: "/programs/ideal-body" },
};

export default function IdealBodyPage() {
  return <GeneratedRouteScreen routeKey="program-ideal-body" />;
}
