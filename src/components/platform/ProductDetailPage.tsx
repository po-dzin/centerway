import { PlatformOfferResultList, PlatformOfferSurfaceTemplate } from "@/components/platform/PlatformOfferSurfaceTemplate";
import type { programs } from "@/lib/platform/content";

type Product = (typeof programs)[number];

export function ProductDetailPage({ product }: { product: Product }) {
  return (
    <PlatformOfferSurfaceTemplate
      templateKind="product"
      hero={{
        title: product.fullTitle,
        description: product.description,
        badge: `${product.tag} · ${product.duration}`,
        artwork: product.artwork,
        imageAlt: product.title,
        templateKind: "product",
        primaryAction: {
          href: "#product-support",
          label: "Перейти до запиту",
        },
        secondaryAction: {
          href: "/products",
          label: "Усі продукти",
        },
      }}
      detailSemanticFamily="method-trust"
      detailLeft={{
        label: "Коли це доречно",
        title: "Продукт не існує поза контекстом стану",
        body: <PlatformOfferResultList items={product.results} />,
      }}
      detailRight={{
        label: "Як входити",
        title: "Три коректні сценарії входу",
        body: (
          <PlatformOfferResultList
            items={[
              "через окрему сторінку замовлення, якщо вже зрозуміло, що потрібна саме ця підтримка;",
              "через тест доши, якщо важливо спочатку зрозуміти стан, ритм і тип навантаження;",
              "через консультацію, якщо потрібен живий підбір і межі методу мають бути проговорені окремо.",
            ]}
          />
        ),
      }}
      supportSectionId="product-support"
      supportLeft={{
        label: "Підбір",
        title: "Запит на підбір природної підтримки",
        lead:
          "Ця сторінка не підміняє діагностику і не робить вигляд, що банку можна обрати без контексту. Залиште запит, якщо хочете пройти через підбір, а не випадкову покупку.",
      }}
      form={{
        label: "Форма",
        title: "Підібрати підтримку",
        productCode: product.slug,
        source: `platform_${product.slug}_form`,
        ctaPlace: `${product.slug}_product_page`,
      }}
      boundary={{
        label: "Межі методу",
        title: "Не лікування і не заміна медичної консультації",
        lead:
          "Трав&apos;яна підтримка CenterWay описується як wellness-продукт усередині більшої системи ритму, харчування і практики. Вона не замінює лікаря, діагностику або медикаментозне лікування, особливо при гострих станах, вагітності, хронічних захворюваннях чи постійній терапії.",
      }}
    />
  );
}
