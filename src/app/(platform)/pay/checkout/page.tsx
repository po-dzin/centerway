import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CheckoutScreen } from "@/components/platform/CheckoutScreen";
import { userFromCookies } from "@/lib/auth/serverSession";
import { activeGateway } from "@/lib/payments/gateway";
import { loadCheckoutSummary } from "@/lib/platform/checkoutSummary";
import type { SearchParams } from "@/lib/products";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Оформлення",
  description: "Перевірка замовлення і адреса для доступу перед оплатою.",
  // A step in one buyer's purchase, addressed by its query string: nothing
  // here is worth a search result.
  noindex: true,
});

/* Per request: the page reads the session to know whether to ask for an
   address at all, and the price is the offer row's price now. */
export const dynamic = "force-dynamic";

/* Carried to /api/pay/start untouched: attribution, the offer the landing
   printed, the pixel's event id. `email` is not one of them — it is the field
   this page asks for. */
function passthrough(params: SearchParams): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, raw] of Object.entries(params)) {
    if (key === "email") continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value) out.push([key, value]);
  }
  return out;
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const product = Array.isArray(params.product) ? params.product[0] : params.product;
  const summary = await loadCheckoutSummary(product);
  // The same answer /api/pay/start gives an unknown or unpriced code.
  if (!summary) notFound();

  const user = await userFromCookies();
  const accountEmail = user?.email_confirmed_at ? user.email?.trim().toLowerCase() || null : null;

  return (
    <CheckoutScreen
      summary={summary}
      fields={passthrough(params)}
      accountEmail={accountEmail}
      gatewayLabel={activeGateway().label}
    />
  );
}
