import type { Metadata } from "next";
import { PlatformLegalTemplate } from "@/components/platform/PlatformLegalTemplate";
import { contact, legal } from "@/lib/platform/content";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Публічний договір",
  description: describe(
    "Публічна оферта CenterWay: умови продажу цифрових онлайн-продуктів, консультацій і супутніх сервісів, оплата, доступ і повернення.",
    { bounded: false }
  ),
  path: "/legal/public-offer",
});

export default function PublicOfferPage() {
  return (
    <PlatformLegalTemplate
      eyebrow="Legal"
      title="Публічний договір"
      lead={legal.publicOffer}
      panels={[
        {
          title: "Предмет договору",
          tone: "policy",
          body: (
            <p>
              CenterWay надає доступ до цифрових матеріалів, онлайн-програм, консультацій та супутніх інформаційних
              сервісів, розміщених на сайті та піддоменах.
            </p>
          ),
        },
        {
          title: "Контакти продавця",
          tone: "support",
          body: (
            <p>
              Email: {contact.email}
              <br />
              Телефон: {contact.phone}
              <br />
              Сайт: https://centerway.net.ua
            </p>
          ),
        },
      ]}
    />
  );
}
