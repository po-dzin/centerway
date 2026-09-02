import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { getOfferMeta } from "@/lib/platform/profile";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = adminClient();
  const normalizedEmail = typeof user.email === "string" ? user.email.trim().toLowerCase() : null;

  const [{ data: platformUser }, { data: doshaView, error: doshaViewError }] = await Promise.all([
    db
      .from("platform_users")
      .select("id, auth_user_id, email, full_name, avatar_url")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    db
      .from("v_user_dosha_test_profile")
      .select("user_id, test_id, test_slug, attempt_id, result_type, score_vata, score_pitta, score_kapha, completed_at, version")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const customerQuery = db
    .from("customers")
    .select("id, auth_user_id, email, phone, tg_id, display_name")
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle();
  const customerFallbackQuery = normalizedEmail
    ? db
        .from("customers")
        .select("id, auth_user_id, email, phone, tg_id, display_name")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [customerByAuth, customerByEmail] = await Promise.all([customerQuery, customerFallbackQuery]);
  const customer = customerByAuth.data ?? customerByEmail.data ?? null;

  /* The @handle, read through the bot's own record of the chat rather than
     copied onto the customer.

     Telegram usernames are MUTABLE — someone can change their handle tomorrow.
     A denormalised copy on `customers` would be a value that is correct once
     and then quietly wrong, with nothing to refresh it. `support_bot_sessions`
     is upserted on every interaction with the bot, including the link itself,
     so the row exists for every linked account and carries the freshest handle
     the bot has seen. The numeric id stays the join key, because that is the
     part Telegram guarantees is stable.

     Not everyone has one: a Telegram account without a public username is
     ordinary, and the id remains the only address for it. */
  let telegramUsername: string | null = null;
  if (customer?.tg_id) {
    const { data: botSession } = await db
      .from("support_bot_sessions")
      .select("telegram_username")
      .eq("telegram_user_id", String(customer.tg_id))
      .maybeSingle();
    const handle = typeof botSession?.telegram_username === "string" ? botSession.telegram_username.trim() : "";
    telegramUsername = handle.length > 0 ? handle.replace(/^@/, "") : null;
  }

  const doshaProfile =
    !doshaViewError && doshaView
      ? {
          attemptId: doshaView.attempt_id,
          testId: doshaView.test_id,
          testSlug: doshaView.test_slug,
          resultType: doshaView.result_type,
          version: doshaView.version,
          completedAt: doshaView.completed_at,
          scores: {
            vata: doshaView.score_vata,
            pitta: doshaView.score_pitta,
            kapha: doshaView.score_kapha,
          },
        }
      : null;

  const ordersQuery = customer?.id
    ? db
        .from("orders")
        .select("id, order_ref, product_code, amount, currency, status, created_at, customer_id")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const ordersResult = await ordersQuery;
  if (ordersResult.error) {
    return NextResponse.json({ error: ordersResult.error.message }, { status: 500 });
  }

  const orders = (ordersResult.data ?? []).map((order) => {
    const offer = getOfferMeta(order.product_code);
    return {
      ...order,
      title: offer.title,
      offerKind: offer.kind,
      offerCode: offer.code,
    };
  });

  /* `access_tokens` is NOT read here any more (2026-09-02), and this is the
     last place that did. Entitlement stopped consulting tokens on 2026-08-29
     (`lms-core/access.ts`), but the cabinet went on labelling every purchase by
     one — so a receipt read «Термін доступу минув» on a course the person still
     fully owned, and every purchase made since the token contour went quiet
     read «Доступ створено» over an order that has no token at all. The status
     of a link says nothing about the status of a purchase; the shelf, keyed by
     the enrollment, is what answers that, and it is one fold away. */
  const purchases = orders
    .filter((order) => order.status === "paid")
    .map((order) => ({
      orderRef: order.order_ref,
      offerCode: order.offerCode,
      offerKind: order.offerKind,
      title: order.title,
      amount: order.amount,
      currency: order.currency,
      createdAt: order.created_at,
    }));

  return NextResponse.json({
    userId: user.id,
    profile: {
      account: {
        email: user.email ?? platformUser?.email ?? customer?.email ?? null,
        fullName:
          (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ??
          (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null) ??
          platformUser?.full_name ??
          customer?.display_name ??
          null,
        avatarUrl:
          (typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null) ??
          (typeof user.user_metadata?.picture === "string" ? user.user_metadata.picture : null) ??
          platformUser?.avatar_url ??
          null,
      },
      contacts: customer
        ? {
            phone: customer.phone ?? null,
            telegram: customer.tg_id ?? null,
            telegramUsername,
          }
        : null,
      dosha: doshaProfile,
      purchases,
      progress: {
        items: [],
        note: "Цей блок збирає карту проходження: активні програми, завершені етапи і доречний наступний крок у платформі.",
      },
    },
  });
}
