import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CheckoutScreen } from "@/components/platform/CheckoutScreen";
import { userFromCookies } from "@/lib/auth/serverSession";
import { activeGateway } from "@/lib/payments/gateway";
import { loadCheckoutSummary } from "@/lib/platform/checkoutSummary";
import { parseContactChannel, type BuyerContact } from "@/lib/platform/buyerContact";
import type { SearchParams } from "@/lib/products";
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
const BUYER_FIELDS = new Set(["email", "name", "channel", "contact"]);

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

/* A returning buyer is not asked twice: the name and messenger their customer
   row already holds. Read for the signed-in buyer only — the session proves
   whose row it is. */
async function savedDetails(email: string): Promise<{ name: string | null; contact: BuyerContact | null }> {
  try {
    const { data } = await supabaseAdmin()
      .from("customers")
      .select("display_name, meta")
      .eq("email", email)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const raw = (data?.meta as { contact?: { channel?: string; value?: unknown } } | null)?.contact;
    const channel = parseContactChannel(raw?.channel);
    return {
      name: data?.display_name ?? null,
      contact: channel && typeof raw?.value === "string" ? { channel, value: raw.value } : null,
    };
  } catch {
    return { name: null, contact: null };
  }
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const product = Array.isArray(params.product) ? params.product[0] : params.product;
  const summary = await loadCheckoutSummary(product);
  // The same answer /api/pay/start gives an unknown or unpriced code.
  if (!summary) notFound();

  const user = await userFromCookies();
  const accountEmail = user?.email_confirmed_at ? user.email?.trim().toLowerCase() || null : null;
  const saved = accountEmail ? await savedDetails(accountEmail) : { name: null, contact: null };
  const accountName =
    typeof user?.user_metadata?.full_name === "string" ? (user.user_metadata.full_name as string) : null;
  const typedChannel = parseContactChannel(first(params, "channel"));
  const typedContact = first(params, "contact");

  return (
    <CheckoutScreen
      summary={summary}
      fields={passthrough(params)}
      accountEmail={accountEmail}
      initial={{
        email: first(params, "email"),
        name: first(params, "name") ?? saved.name ?? accountName,
        contact:
          typedChannel || typedContact
            ? { channel: typedChannel ?? "telegram", value: typedContact ?? "" }
            : saved.contact,
      }}
      gatewayLabel={activeGateway().label}
    />
  );
}
