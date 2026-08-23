import { permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Detox",
  description: describe(
    "Стара адреса детоксу CenterWay. Актуальна програма живе на сторінці «Шлях 21»: харчування, трави, режим дня і щоденні опори."
  ),
  noindex: true,
});

export default function DetoxProgramPage() {
  permanentRedirect("/programs/way21");
}
