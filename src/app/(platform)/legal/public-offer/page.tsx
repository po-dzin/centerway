import type { Metadata } from "next";
import { PlatformLegalTemplate } from "@/components/platform/PlatformLegalTemplate";
import { PUBLIC_OFFER_LEAD, PublicOfferDocument } from "@/components/platform/legal/PublicOfferDocument";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Публічний договір",
  description: describe(
    "Публічна оферта CenterWay: умови продажу цифрових онлайн-продуктів, консультацій і супутніх сервісів, оплата, доступ і повернення.",
    { bounded: false },
  ),
  path: "/legal/public-offer",
});

export default function PublicOfferPage() {
  return (
    <PlatformLegalTemplate
      eyebrow="Legal"
      title="Публічний договір"
      lead={PUBLIC_OFFER_LEAD}
      document={<PublicOfferDocument />}
    />
  );
}
