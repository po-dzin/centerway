import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Reset Day - CenterWay",
  description: "Legacy alias route for the Reset Day static funnel.",
  alternates: { canonical: "https://resetday.centerway.net.ua/" },
};

export default function MiniDetoxProgramPage() {
  permanentRedirect("https://resetday.centerway.net.ua/");
}
