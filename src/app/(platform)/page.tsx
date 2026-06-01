import type { Metadata } from "next";
import { PlatformHomePage } from "@/components/platform/PlatformStandalonePages";

export const metadata: Metadata = {
  title: "CenterWay - аюрведична платформа відновлення",
  description:
    "Платформений хаб CenterWay: консультації Євгенія Корякіна, аюрведичні програми, тест доши, детокс і відновлююча гімнастика.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return <PlatformHomePage />;
}
