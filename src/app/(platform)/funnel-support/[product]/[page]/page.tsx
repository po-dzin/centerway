import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PlatformLegalTemplate } from "@/components/platform/PlatformLegalTemplate";
import type { ProductKey } from "@/lib/surfaces/catalog";
import { getFunnelHostUrl, getPlatformRoute, getProductSurfaceEntry } from "@/lib/surfaces/catalog";
import { contact, legal } from "@/lib/platform/content";

type UtilityPageKey = "thanks" | "pay-failed" | "public-offer";
type GeneratedFunnelProduct = Extract<ProductKey, "consult" | "detox">;

type PageProps = {
  params: Promise<{
    product: string;
    page: string;
  }>;
};

const PRODUCT_LABELS: Record<GeneratedFunnelProduct, string> = {
  consult: "Консультація",
  detox: "Detox",
};

function isGeneratedFunnelProduct(value: string): value is GeneratedFunnelProduct {
  return value === "consult" || value === "detox";
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
  const panels =
    resolved.page === "public-offer"
      ? [
          {
            title: "Предмет договору",
            tone: "policy" as const,
            body: (
              <p>
                CenterWay надає доступ до цифрових матеріалів, онлайн-програм, консультацій та супутніх інформаційних сервісів,
                розміщених на сайті та піддоменах.
              </p>
            ),
          },
          {
            title: "Контакти продавця",
            tone: "support" as const,
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
        ]
      : [];
  const actions = [
    resolved.hostUrl ? { href: resolved.hostUrl, label: copy.ctaLabel } : null,
    resolved.platformRoute ? { href: resolved.platformRoute, label: "Відкрити сторінку продукту", tone: "secondary" as const } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; tone?: "secondary" }>;

  return (
    <PlatformLegalTemplate
      eyebrow={copy.eyebrow}
      title={copy.title}
      lead={copy.lead}
      panels={panels}
      actions={actions}
      shellMode="plain"
    >
      {resolved.page === "public-offer" ? (
        <article>
          <Link href="/legal/public-offer">Повна платформа-версія договору</Link>
        </article>
      ) : null}
    </PlatformLegalTemplate>
  );
}
