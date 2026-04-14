import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";

export const metadata = {
  title: "CenterWay Herbs | Вхід через трави",
  description: "CenterWay Herbs: сторінка входу через трав'яний напрям.",
  openGraph: {
    title: "CenterWay Herbs | Вхід через трави",
    description:
      "Структурована програма на 21 день: меню, ритм дня, підтримка травлення та відновлення без крайнощів і маніпулятивних обіцянок.",
    type: "website",
    locale: "uk_UA",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function HerbsPage() {
  return <GeneratedRouteScreen routeKey="herbs" />;
}
