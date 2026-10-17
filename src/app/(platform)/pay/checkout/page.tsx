import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CheckoutScreen } from "@/components/platform/CheckoutScreen";
import { userFromCookies } from "@/lib/auth/serverSession";
import { activeGateway } from "@/lib/payments/gateway";
import { resolvePersonalPrice } from "@/lib/landing/offers";
import { loadCheckoutSummary } from "@/lib/platform/checkoutSummary";
import { formatPrice, type SearchParams } from "@/lib/products";
import { pageMetadata } from "@/lib/seo/metadata";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
   printed, the pixel's event id. The buyer's own fields are not among them —
   they are what this page asks for, and come back here filled in when
   /api/pay/start sends the buyer back for a missing one. */
const BUYER_FIELDS = new Set(["email", "name", "contact"]);

function first(params: SearchParams, key: string): string | null {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value ? value : null;
}

function passthrough(params: SearchParams): [string, string][] {
  const out: [string, string][] = [];
  for (const key of Object.keys(params)) {
    if (BUYER_FIELDS.has(key)) continue;
    const value = first(params, key);
    if (value) out.push([key, value]);
  }
  return out;
}

/* A returning buyer is not asked twice: the name and contact their customer
   row already holds. Read for the signed-in buyer only — the session proves
   whose row it is. */
type Saved = { name: string | null; contact: string | null };
const NOTHING_SAVED: Saved = { name: null, contact: null };

async function savedDetails(email: string): Promise<Saved> {
  try {
    const { data } = await supabaseAdmin()
      .from("customers")
      .select("display_name, meta")
      .eq("email", email)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const meta = (data?.meta ?? null) as { contact?: { value?: unknown } } | null;
    return {
      name: data?.display_name ?? null,
      contact: typeof meta?.contact?.value === "string" ? meta.contact.value : null,
    };
  } catch {
    return NOTHING_SAVED;
  }
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const product = Array.isArray(params.product) ? params.product[0] : params.product;
  const publicSummary = await loadCheckoutSummary(product);
  // The same answer /api/pay/start gives an unknown or unpriced code.
  if (!publicSummary) notFound();

  /* A personal price (`offer_token`, carried here by the program page) is the
     figure /api/pay/start will charge, so it is the one this page confirms. */
  const personal = await resolvePersonalPrice(publicSummary.code, params);
  const summary = personal
    ? {
        ...publicSummary,
        price: formatPrice(personal.amount, personal.currency),
        compareAtPrice:
          personal.oldAmount !== null && personal.oldAmount > personal.amount
            ? formatPrice(personal.oldAmount, personal.currency)
            : null,
      }
    : publicSummary;

  const user = await userFromCookies();
  const accountEmail = user?.email_confirmed_at ? user.email?.trim().toLowerCase() || null : null;
  const saved = accountEmail ? await savedDetails(accountEmail) : NOTHING_SAVED;
  const accountName =
    typeof user?.user_metadata?.full_name === "string" ? (user.user_metadata.full_name as string) : null;

  const gateway = activeGateway();

  return (
    <CheckoutScreen
      summary={summary}
      fields={passthrough(params)}
      accountEmail={accountEmail}
      initial={{
        email: first(params, "email"),
        name: first(params, "name") ?? saved.name ?? accountName,
        contact: first(params, "contact") ?? saved.contact,
      }}
      gatewayLabel={gateway.label}
      gatewayLogo={gateway.logo ?? null}
    />
  );
}
