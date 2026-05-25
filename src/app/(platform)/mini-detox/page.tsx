import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Mini Detox - короткий маршрут CenterWay",
  description: "Standalone-сторінка Mini Detox: 3 дні м'якого розвантаження, режиму і спостереження за сигналами тіла без медичних обіцянок.",
  alternates: { canonical: "/programs/mini-detox" },
};

export default function MiniDetoxPage() {
  redirect("/programs/mini-detox");
}
