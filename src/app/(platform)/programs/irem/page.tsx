import type { Metadata } from "next";
import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";

export const metadata: Metadata = {
  title: "IREM Гімнастика - CenterWay",
  description: "Платформена сторінка IREM Гімнастики: рух, тіло, енергія, легкість і робота з м'язовими затискачами.",
  alternates: { canonical: "/programs/irem" },
};

export default function IremPage() {
  return <GeneratedRouteScreen routeKey="program-irem" />;
}
