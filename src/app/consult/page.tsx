import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";

export const metadata = {
  title: "CenterWay | Аюрведична консультація",
  description:
    "Персональна аюрведична консультація від CenterWay: структура кроків, онлайн-формат до 90 хв, зрозумілий план на 2-4 тижні та прозорі межі методу.",
  openGraph: {
    title: "CenterWay | Аюрведична консультація",
    description:
      "Персональна консультація: аюрведичний профіль, харчування, режим, відновлення і чіткий план дій без маніпуляцій.",
    type: "website",
    locale: "uk_UA",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function ConsultPage() {
  return <GeneratedRouteScreen routeKey="consult" />;
}
