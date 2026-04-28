import type { Metadata } from "next";
import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";

export const metadata: Metadata = {
  title: "Mini Detox - короткий маршрут CenterWay",
  description: "Standalone-сторінка Mini Detox: 3 дні м'якого розвантаження, режиму і спостереження за сигналами тіла без медичних обіцянок.",
  alternates: { canonical: "/mini-detox" },
};

export default function MiniDetoxPage() {
  return <GeneratedRouteScreen routeKey="mini-detox" />;
}
