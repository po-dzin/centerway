import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";
import { getProductByHost } from "@/lib/surfaces/catalog";

export const metadata: Metadata = {
  title: "Mini Detox - короткий маршрут CenterWay",
  description: "Standalone-сторінка Mini Detox: 3 дні м'якого розвантаження, режиму і спостереження за сигналами тіла без медичних обіцянок.",
  alternates: { canonical: "/programs/mini-detox" },
};

export default async function MiniDetoxPage() {
  const headerStore = await headers();
  const requestHost = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (getProductByHost(requestHost) !== "mini-detox") {
    redirect("/programs/mini-detox");
  }

  return <GeneratedRouteScreen routeKey="mini-detox" />;
}
