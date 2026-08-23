import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Reset Day: короткий практикум",
    description: describe(
      "Один розвантажувальний день як три дні уваги: підготовка, сам день простого харчування і коректний вихід із поясненням сигналів тіла."
    ),
  }),
  // The funnel host owns this offer's public address; this alias only forwards.
  alternates: { canonical: "https://resetday.centerway.net.ua/" },
};

export default function MiniDetoxPage() {
  permanentRedirect("https://resetday.centerway.net.ua/");
}
