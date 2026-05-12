import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ProductKey } from "@/lib/surfaces/catalog";
import { getFunnelHostUrl, getPlatformRoute, getProductSurfaceEntry } from "@/lib/surfaces/catalog";
import { contact, legal } from "@/lib/platform/content";

type UtilityPageKey = "thanks" | "pay-failed" | "public-offer";
type GeneratedFunnelProduct = Extract<ProductKey, "consult" | "detox" | "mini-detox">;

type PageProps = {
  params: Promise<{
    product: string;
    page: string;
  }>;
};

const PRODUCT_LABELS: Record<GeneratedFunnelProduct, string> = {
  consult: "Консультація",
  detox: "Detox",
  "mini-detox": "Mini Detox",
};

function isGeneratedFunnelProduct(value: string): value is GeneratedFunnelProduct {
  return value === "consult" || value === "detox" || value === "mini-detox";
}

function isUtilityPage(value: string): value is UtilityPageKey {
  return value === "thanks" || value === "pay-failed" || value === "public-offer";
}

function resolveFunnelUtility(product: string, page: string) {
  if (!isGeneratedFunnelProduct(product) || !isUtilityPage(page)) {
    return null;
  }

  const entry = getProductSurfaceEntry(product);
  if (entry.funnelRuntime !== "generated-app" || entry.status !== "active") {
    return null;
  }

  return {
    page,
    product,
    label: PRODUCT_LABELS[product],
    hostUrl: getFunnelHostUrl(product),
    platformRoute: getPlatformRoute(product),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { product, page } = await params;
  const resolved = resolveFunnelUtility(product, page);
  if (!resolved) {
    return {};
  }

  const title =
    page === "thanks"
      ? `Дякуємо - ${resolved.label} - CenterWay`
      : page === "pay-failed"
        ? `Оплата не завершена - ${resolved.label} - CenterWay`
        : `Публічний договір - ${resolved.label} - CenterWay`;

  return {
    title,
    robots: {
      index: false,
      follow: false,
    },
  };
}

function pageCopy(page: UtilityPageKey, label: string) {
  if (page === "thanks") {
    return {
      eyebrow: "Крок зафіксовано",
      title: "Дякуємо. Заявка або оплата зафіксована.",
      lead: `Маршрут ${label} зафіксовано. Далі переходьте до узгодженого каналу супроводу або поверніться на основну сторінку продукту.`,
      ctaLabel: "Повернутися до лендингу",
    };
  }

  if (page === "pay-failed") {
    return {
      eyebrow: "Потрібна дія",
      title: "Оплата не завершена",
      lead: `Спроба для ${label} не була завершена. Ви можете повернутися на лендинг і повторити крок або звернутися в підтримку.`,
      ctaLabel: "Повернутися до оплати",
    };
  }

  return {
    eyebrow: "Legal",
    title: "Публічний договір",
    lead: legal.publicOffer,
    ctaLabel: "Повернутися до лендингу",
  };
}

export default async function FunnelUtilityPage({ params }: PageProps) {
  const { product, page } = await params;
  const resolved = resolveFunnelUtility(product, page);
  if (!resolved) {
    notFound();
  }

  const copy = pageCopy(resolved.page, resolved.label);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg, #f6f1e8)",
        color: "var(--text, #1d1a17)",
        padding: "48px 20px 64px",
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          display: "grid",
          gap: "20px",
        }}
      >
        <section
          style={{
            background: "rgba(255,255,255,0.82)",
            border: "1px solid rgba(29,26,23,0.12)",
            borderRadius: "24px",
            padding: "28px",
            boxShadow: "0 18px 50px rgba(29,26,23,0.08)",
          }}
        >
          <p style={{ margin: "0 0 10px", fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.68 }}>
            {copy.eyebrow}
          </p>
          <h1 style={{ margin: "0 0 12px", fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1.05 }}>{copy.title}</h1>
          <p style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.7, opacity: 0.86 }}>{copy.lead}</p>
        </section>

        {resolved.page === "public-offer" ? (
          <article
            style={{
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(29,26,23,0.1)",
              borderRadius: "24px",
              padding: "28px",
              display: "grid",
              gap: "16px",
            }}
          >
            <section>
              <h2 style={{ margin: "0 0 8px" }}>Предмет договору</h2>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                CenterWay надає доступ до цифрових матеріалів, онлайн-програм, консультацій та супутніх інформаційних сервісів,
                розміщених на сайті та піддоменах.
              </p>
            </section>
            <section>
              <h2 style={{ margin: "0 0 8px" }}>Контакти продавця</h2>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                Email: {contact.email}
                <br />
                Телефон: {contact.phone}
                <br />
                Сайт: https://centerway.net.ua
              </p>
            </section>
            <section>
              <Link href="/legal/public-offer">Повна платформа-версія договору</Link>
            </section>
          </article>
        ) : null}

        <section style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {resolved.hostUrl ? (
            <Link
              href={resolved.hostUrl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "48px",
                padding: "0 18px",
                borderRadius: "999px",
                background: "#1d1a17",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              {copy.ctaLabel}
            </Link>
          ) : null}
          {resolved.platformRoute ? (
            <Link
              href={resolved.platformRoute}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "48px",
                padding: "0 18px",
                borderRadius: "999px",
                border: "1px solid rgba(29,26,23,0.14)",
                color: "inherit",
                textDecoration: "none",
                background: "rgba(255,255,255,0.72)",
              }}
            >
              Відкрити сторінку продукту
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
