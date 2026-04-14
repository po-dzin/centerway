import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";

export const metadata = {
  title: "CenterWay Detox | Програма м'якого перезавантаження",
  description:
    "CenterWay Detox: 21-денна програма м'якого перезавантаження харчування та ритму життя, з чітким планом, межами методу і супроводом у Telegram.",
  openGraph: {
    title: "CenterWay Detox | Програма м'якого перезавантаження",
    description:
      "Структурована програма на 21 день: меню, ритм дня, підтримка травлення та відновлення без крайнощів і маніпулятивних обіцянок.",
    type: "website",
    locale: "uk_UA",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function DetoxPage() {
  return <GeneratedRouteScreen routeKey="detox" />;
}
