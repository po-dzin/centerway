import { PlatformOfferResultList, PlatformOfferSurfaceTemplate } from "@/components/platform/PlatformOfferSurfaceTemplate";
import { OfferCheckoutPanel } from "@/components/platform/OfferCommerce";
import { resolveOfferCommerce } from "@/lib/platform/offerCommerce";
import type { programs } from "@/lib/platform/content";
import { JsonLd } from "@/lib/seo/StructuredData";
import { breadcrumbLd, graph, productLd } from "@/lib/seo/jsonLd";

type Product = (typeof programs)[number];

/**
 * A product page.
 *
 * Same rule as a programme: it sells itself when there is a price to quote, and
 * asks when there is not. Today `herbs` is in the second case on purpose — it
 * has a checkout route but no agreed figure (docs/checkout-test-flow-2026-08-21.md),
 * and an individual blend is chosen against a state rather than added to a cart.
 * The moment a price is set in `products.ts`, this page starts selling with no
 * edit here.
 */
export function ProductDetailPage({ product }: { product: Product }) {
  const commerce = resolveOfferCommerce(product.slug);

  return (
    <PlatformOfferSurfaceTemplate
      templateKind="product"
      afterHero={
        /* No Offer node while there is no agreed price — see productLd. The
           product is still named, described and attributed to the brand, which
           is what makes it citable at all. */
        <JsonLd
          data={graph(
            productLd({
              path: `/products/${product.slug}`,
              name: product.fullTitle,
              description: product.longDescription || product.description,
              price: commerce.mode === "checkout" ? commerce.amount : null,
              currency: commerce.mode === "checkout" ? commerce.currency : undefined,
              ...(product.artwork ? { image: product.artwork.desktop } : {}),
            }),
            breadcrumbLd([
              { path: "/", name: "CenterWay" },
              { path: "/products", name: "Продукти" },
              { path: `/products/${product.slug}`, name: product.title },
            ])
          )}
        />
      }
      trail={[{ label: "Продукти", href: "/products" }, { label: product.title }]}
      hero={{
        title: product.fullTitle,
        description: product.description,
        badge: `${product.tag} · ${product.duration}`,
        artwork: product.artwork,
        imageAlt: product.title,
        templateKind: "product",
        primaryAction: {
          href: "#product-support",
          label: commerce.mode === "checkout" ? `Купити за ${commerce.price}` : "Перейти до запиту",
        },
        secondaryAction: {
          href: "#product-details",
          label: "Коли це доречно",
        },
      }}
      detailSectionId="product-details"
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
      form={
        commerce.mode === "lead"
          ? {
              label: "Форма",
              title: "Підібрати підтримку",
              productCode: commerce.leadProductCode,
              source: `platform_${product.slug}_form`,
              ctaPlace: `${product.slug}_product_page`,
            }
          : undefined
      }
      supportRight={
        commerce.mode === "checkout" ? (
          <OfferCheckoutPanel
            commerce={commerce}
            label="Оплата"
            title={product.title}
            lead={product.description}
            includes={[
              "разова оплата, без підписки",
              "після оплати підтвердження і наступний крок приходять у кабінет",
              "склад і доречність можна уточнити до оплати",
            ]}
            ctaLabel={`Оплатити ${commerce.price}`}
          />
        ) : undefined
      }
    />
  );
}
